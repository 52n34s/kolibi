#!/usr/bin/env bash
# Runs a Maestro flow against the "Kolibi QA" simulator only (never another device).
# Usage: scripts/week-test/maestro.sh <flow.yaml> [more maestro args]
# Needs KOLIBI_QA_UDID (the simulator created for the week test) and a JDK;
# falls back to Homebrew openjdk@21 when JAVA_HOME is unset.
set -euo pipefail
: "${KOLIBI_QA_UDID:?set KOLIBI_QA_UDID to the Kolibi QA simulator UDID}"
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME=$(ls -d /opt/homebrew/Cellar/openjdk@21/*/libexec/openjdk.jdk/Contents/Home 2>/dev/null | head -1)
  export JAVA_HOME
fi
export PATH="$JAVA_HOME/bin:$PATH"
exec maestro --device "$KOLIBI_QA_UDID" test --test-output-dir "${WEEK_TEST_OUT:-$HOME/Desktop/kolibi-week-test}" "$@"
