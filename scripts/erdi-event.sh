#!/usr/bin/env bash
set -euo pipefail

read_erdi_token() {
  local file="$1"
  local line value
  line="$(grep -E '^ERDI_TOKEN=' "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  value="${line#ERDI_TOKEN=}"
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

if [[ -z "${ERDI_TOKEN:-}" && -f "$env_file" ]]; then
  ERDI_TOKEN="$(read_erdi_token "$env_file" || true)"
fi

if [[ -z "${ERDI_TOKEN:-}" ]]; then
  echo 'No ERDI_TOKEN found — checked the environment and ./.env.local' >&2
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
