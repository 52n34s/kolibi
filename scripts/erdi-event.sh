#!/usr/bin/env bash
set -euo pipefail

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

if [[ -z "${ERDI_TOKEN_EVENTS:-}" && -f "$env_file" ]]; then
  ERDI_TOKEN_EVENTS="$(read_dotenv "$env_file" ERDI_TOKEN_EVENTS || true)"
fi
if [[ -z "${ERDI_TOKEN:-}" && -f "$env_file" ]]; then
  ERDI_TOKEN="$(read_dotenv "$env_file" ERDI_TOKEN || true)"
fi
ERDI_TOKEN="${ERDI_TOKEN_EVENTS:-${ERDI_TOKEN:-}}"

if [[ -z "${ERDI_TOKEN:-}" ]]; then
  echo 'No ERDI_TOKEN_EVENTS or ERDI_TOKEN found — checked the environment and ./.env.local' >&2
  exit 1
fi

TITLE="${1:?Usage: scripts/erdi-event.sh \"What you shipped\"}"
ERDI_URL="${ERDI_URL:-https://erdiknows.com}"

export TITLE ERDI_URL ERDI_TOKEN
python3 <<'PY'
import json
import os
import urllib.error
import urllib.request

title = os.environ["TITLE"]
url = os.environ["ERDI_URL"].rstrip("/") + "/api/v1/events"
body = json.dumps({"kind": "deploy", "title": title, "source": "agent"}).encode()
req = urllib.request.Request(
    url,
    data=body,
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
    raise SystemExit(f"Erdi event failed ({err.code}): {detail}") from err
PY
