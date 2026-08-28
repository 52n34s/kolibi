#!/usr/bin/env bash
set -euo pipefail

# Post daily product metrics to ErdiKnows.
# Implement collect_range only — do not invent metrics your schema cannot compute.

read_dotenv() {
  local file="$1" key="$2" line value
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  value="${line#${key}=}"
  value="${value%$'\r'}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
env_file="$repo_root/.env.local"

if [[ -z "${ERDI_TOKEN_METRICS:-}" && -f "$env_file" ]]; then
  ERDI_TOKEN_METRICS="$(read_dotenv "$env_file" ERDI_TOKEN_METRICS || true)"
fi
if [[ -z "${ERDI_TOKEN:-}" && -f "$env_file" ]]; then
  ERDI_TOKEN="$(read_dotenv "$env_file" ERDI_TOKEN || true)"
fi
ERDI_TOKEN="${ERDI_TOKEN_METRICS:-${ERDI_TOKEN:-}}"

if [[ -z "${ERDI_TZ:-}" && -f "$env_file" ]]; then
  ERDI_TZ="$(read_dotenv "$env_file" ERDI_TZ || true)"
fi
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$env_file" ]]; then
  SUPABASE_DB_URL="$(read_dotenv "$env_file" SUPABASE_DB_URL || true)"
fi

if [[ -z "${ERDI_TOKEN:-}" ]]; then
  echo 'No ERDI_TOKEN_METRICS or ERDI_TOKEN found — checked the environment and ./.env.local' >&2
  exit 1
fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo 'No SUPABASE_DB_URL found — checked the environment and ./.env.local' >&2
  exit 1
fi

ERDI_URL="${ERDI_URL:-https://erdiknows.com}"
ERDI_TZ="${ERDI_TZ:-Europe/Berlin}"

FROM_DAY=""
TO_DAY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      FROM_DAY="${2:?--from needs YYYY-MM-DD}"
      shift 2
      ;;
    --to)
      TO_DAY="${2:?--to needs YYYY-MM-DD}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: scripts/erdi-metrics.sh [--from YYYY-MM-DD] [--to YYYY-MM-DD]"
      echo "Defaults: yesterday in ERDI_TZ (inclusive)."
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TO_DAY" ]]; then
  TO_DAY="$(TZ="$ERDI_TZ" date -d 'yesterday' +%Y-%m-%d 2>/dev/null || TZ="$ERDI_TZ" date -v-1d +%Y-%m-%d)"
fi
if [[ -z "$FROM_DAY" ]]; then
  FROM_DAY="$TO_DAY"
fi

# ---------------------------------------------------------------------------
# Query Kolibi Postgres. Day buckets use ERDI_TZ (default Europe/Berlin),
# matching public.v_daily_active_users_v2. Skip days before each series'
# first real row — zeros only mean "nobody did it that day" after launch.
# ---------------------------------------------------------------------------
collect_range() {
  local from="$1" to="$2"
  export SUPABASE_DB_URL ERDI_TZ FROM_DAY="$from" TO_DAY="$to"
  python3 <<'PY'
import json
import os
import sys
from datetime import date, datetime

try:
    import psycopg2
except ImportError:
    print("psycopg2 is not installed (pip install psycopg2-binary)", file=sys.stderr)
    sys.exit(1)

tz = os.environ["ERDI_TZ"]
from_day = date.fromisoformat(os.environ["FROM_DAY"])
to_day = date.fromisoformat(os.environ["TO_DAY"])
db_url = os.environ["SUPABASE_DB_URL"]


def parse_day(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


conn = psycopg2.connect(db_url)
try:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          (SELECT MIN((created_at AT TIME ZONE %s)::date) FROM auth.users),
          (SELECT MIN((created_at AT TIME ZONE %s)::date)
             FROM auth.users WHERE COALESCE(is_anonymous, false) IS NOT TRUE),
          (SELECT MIN(day) FROM public.v_daily_active_users_v2),
          (SELECT MIN((created_at AT TIME ZONE %s)::date) FROM public.meals),
          (SELECT MIN((created_at AT TIME ZONE %s)::date) FROM public.scan_logs),
          (SELECT MIN((onboarded_at AT TIME ZONE %s)::date)
             FROM public.profiles WHERE onboarded_at IS NOT NULL),
          (SELECT MIN((logged_at AT TIME ZONE %s)::date) FROM public.weight_logs),
          (SELECT MIN((created_at AT TIME ZONE %s)::date)
             FROM public.scan_logs
             WHERE estimated_cost_usd IS NOT NULL),
          (SELECT MIN((created_at AT TIME ZONE %s)::date)
             FROM public.scan_logs
             WHERE input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
        """,
        (tz, tz, tz, tz, tz, tz, tz, tz),
    )
    (
        first_signup,
        first_signup_registered,
        first_dau,
        first_meal,
        first_scan,
        first_onboard,
        first_weight,
        first_ai_cost,
        first_ai_call,
    ) = [parse_day(v) for v in cur.fetchone()]

    candidates = [
        d
        for d in (
            first_signup,
            first_signup_registered,
            first_dau,
            first_meal,
            first_scan,
            first_onboard,
            first_weight,
            first_ai_cost,
            first_ai_call,
        )
        if d is not None
    ]
    if not candidates:
        print("[]")
        raise SystemExit(0)

    data_start = max(from_day, min(candidates))
    if data_start > to_day:
        print("[]")
        raise SystemExit(0)

    cur.execute(
        """
        WITH days AS (
          SELECT generate_series(%s::date, %s::date, '1 day'::interval)::date AS day
        ),
        dau AS (
          SELECT day, active_users
          FROM public.v_daily_active_users_v2
          WHERE day BETWEEN %s::date AND %s::date
        ),
        signups AS (
          SELECT (created_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM auth.users
          WHERE (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        signups_registered AS (
          SELECT (created_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM auth.users
          WHERE COALESCE(is_anonymous, false) IS NOT TRUE
            AND (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        meals AS (
          SELECT (created_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM public.meals
          WHERE (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        scans AS (
          SELECT (created_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM public.scan_logs
          WHERE (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        scans_success AS (
          SELECT (created_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM public.scan_logs
          WHERE status = 'success'
            AND (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        onboardings AS (
          SELECT (onboarded_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM public.profiles
          WHERE onboarded_at IS NOT NULL
            AND (onboarded_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        weight_logs AS (
          SELECT (logged_at AT TIME ZONE %s)::date AS day, COUNT(*)::bigint AS n
          FROM public.weight_logs
          WHERE (logged_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        ai_cost AS (
          SELECT
            (created_at AT TIME ZONE %s)::date AS day,
            COALESCE(SUM(estimated_cost_usd), 0)::float8 AS n
          FROM public.scan_logs
          WHERE estimated_cost_usd IS NOT NULL
            AND (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        ),
        ai_calls AS (
          SELECT
            (created_at AT TIME ZONE %s)::date AS day,
            COUNT(*)::bigint AS n
          FROM public.scan_logs
          WHERE (input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
            AND (created_at AT TIME ZONE %s)::date BETWEEN %s::date AND %s::date
          GROUP BY 1
        )
        SELECT
          d.day::text,
          dau.active_users,
          signups.n,
          signups_registered.n,
          meals.n,
          scans.n,
          scans_success.n,
          onboardings.n,
          weight_logs.n,
          ai_cost.n,
          ai_calls.n
        FROM days d
        LEFT JOIN dau ON dau.day = d.day
        LEFT JOIN signups ON signups.day = d.day
        LEFT JOIN signups_registered ON signups_registered.day = d.day
        LEFT JOIN meals ON meals.day = d.day
        LEFT JOIN scans ON scans.day = d.day
        LEFT JOIN scans_success ON scans_success.day = d.day
        LEFT JOIN onboardings ON onboardings.day = d.day
        LEFT JOIN weight_logs ON weight_logs.day = d.day
        LEFT JOIN ai_cost ON ai_cost.day = d.day
        LEFT JOIN ai_calls ON ai_calls.day = d.day
        ORDER BY d.day
        """,
        (
            data_start.isoformat(),
            to_day.isoformat(),
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
            tz,
            tz,
            data_start.isoformat(),
            to_day.isoformat(),
        ),
    )
    rows = cur.fetchall()
finally:
    conn.close()

# No revenue/paying_users — subscriptions has current state only.
# ai_cost_per_scan omitted — Erdi can derive from ai_cost + ai_calls.
# Only meal-vision scans call a model today → one Cost pair, not per-type names.
defs = (
    # metric, label, unit, direction, group, role, col_idx, first_day, as_float
    ("dau", "Daily active users", "count", "up_good", "Users", "users", 1, first_dau, False),
    ("signups", "Signups (all auth users)", "count", "up_good", "Users", "signups", 2, first_signup, False),
    (
        "signups_registered",
        "Signups (non-anonymous)",
        "count",
        "up_good",
        "Users",
        "",
        3,
        first_signup_registered,
        False,
    ),
    ("onboardings", "Onboardings completed", "count", "up_good", "Users", "", 7, first_onboard, False),
    ("meals_logged", "Meals logged", "count", "up_good", "Engagement", "", 4, first_meal, False),
    ("scans", "Meal scans", "count", "up_good", "Engagement", "", 5, first_scan, False),
    ("scans_success", "Successful meal scans", "count", "up_good", "Engagement", "", 6, first_scan, False),
    ("weight_logs", "Weight logs", "count", "up_good", "Engagement", "", 8, first_weight, False),
    ("ai_cost", "AI cost (meal scans)", "currency", "down_good", "Cost", "cost", 9, first_ai_cost, True),
    ("ai_calls", "AI model calls (meal scans)", "count", "down_good", "Cost", "", 10, first_ai_call, False),
)

out = []
for row in rows:
    day = date.fromisoformat(row[0])
    for metric, label, unit, direction, group, role, idx, first, as_float in defs:
        if first is None or day < first:
            continue
        raw = row[idx]
        if as_float:
            value = 0.0 if raw is None else round(float(raw), 6)
        else:
            value = 0 if raw is None else int(raw)
        item = {
            "metric": metric,
            "day": day.isoformat(),
            "value": value,
            "label": label,
            "unit": unit,
            "group": group,
            "direction": direction,
        }
        if role:
            item["role"] = role
        out.append(item)

print(json.dumps(out, separators=(",", ":")))
PY
}

PAYLOAD="$(collect_range "$FROM_DAY" "$TO_DAY")"

export ERDI_URL ERDI_TOKEN PAYLOAD
python3 <<'PY'
import json
import os
import urllib.error
import urllib.request

raw = os.environ["PAYLOAD"].strip() or "[]"
try:
    body = json.loads(raw)
except json.JSONDecodeError as err:
    raise SystemExit(f"collect_range must print JSON: {err}") from err

if not isinstance(body, list):
    raise SystemExit("collect_range must print a JSON array")

url = os.environ["ERDI_URL"].rstrip("/") + "/api/v1/metrics"
req = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    headers={
        "Authorization": f"Bearer {os.environ['ERDI_TOKEN']}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode() or "Posted.")
except urllib.error.HTTPError as err:
    detail = err.read().decode()
    raise SystemExit(f"Erdi metrics failed ({err.code}): {detail}") from err
PY
