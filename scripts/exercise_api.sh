#!/usr/bin/env bash
set -euo pipefail

# Exercises validate + store endpoints with a payload.
#
# Usage examples:
#   API_BASE=http://localhost:3000 TENANT_API_KEY=... ./scripts/exercise_api.sh
#   API_BASE=http://localhost:3000 ADMIN_KEY=... TENANT_ID=TalentConsultingSandBox ./scripts/exercise_api.sh
#
# Notes:
# - If TENANT_API_KEY is not set, this script will try to create the tenant via POST /accounts
#   using ADMIN_KEY and use the returned apiKey.
# - The payload file must contain a "name" that matches the serviceName path segment.

API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_KEY="${ADMIN_KEY:-}"
TENANT_ID="${TENANT_ID:-TalentConsultingSandBox}"
TENANT_COMPANY_NAME="${TENANT_COMPANY_NAME:-Talent Consulting Sandbox}"
TENANT_BILLING_EMAIL="${TENANT_BILLING_EMAIL:-sandbox@example.com}"
TENANT_PLAN="${TENANT_PLAN:-pro}"
TENANT_API_KEY="${TENANT_API_KEY:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PAYLOAD_FILE="${PAYLOAD_FILE:-$ROOT_DIR/src/api/test/assets/2.0.0/valid-service-metadata-service1.json}"
SERVICE_NAME="${SERVICE_NAME:-domaina.service1}"
SCHEMA_VERSION="${SCHEMA_VERSION:-2.0.1}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_cmd curl
require_cmd python3

auth_header() {
  local key="$1"
  printf "Authorization: Bearer %s" "$key"
}

json_get() {
  local json="$1"
  local path="$2"
  python3 - <<PY
import json,sys
obj=json.loads(sys.argv[1])
path=sys.argv[2].split(".")
cur=obj
for p in path:
    cur=cur[p]
print(cur)
PY
}

create_tenant_if_needed() {
  if [[ -n "$TENANT_API_KEY" ]]; then
    return 0
  fi
  if [[ -z "$ADMIN_KEY" ]]; then
    echo "TENANT_API_KEY is not set and ADMIN_KEY is empty; can't create a tenant." >&2
    echo "Set TENANT_API_KEY (preferred) or ADMIN_KEY." >&2
    exit 1
  fi

  echo "Creating tenant '$TENANT_ID' via POST /accounts (admin)..."
  local body
  body="$(python3 - <<PY
import json
print(json.dumps({
  "tenantId": "${TENANT_ID}",
  "companyName": "${TENANT_COMPANY_NAME}",
  "billingEmail": "${TENANT_BILLING_EMAIL}",
  "plan": "${TENANT_PLAN}",
}))
PY
)"

  # If it already exists, API returns 409; in that case, you must provide TENANT_API_KEY.
  set +e
  local resp
  resp="$(curl -sS -w "\n%{http_code}" \
    -H "$(auth_header "$ADMIN_KEY")" \
    -H "content-type: application/json" \
    -d "$body" \
    "$API_BASE/accounts")"
  set -e

  local http_code="${resp##*$'\n'}"
  local json="${resp%$'\n'*}"
  if [[ "$http_code" == "201" ]]; then
    TENANT_API_KEY="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["apiKey"])' <<<"$json")"
    echo "Created tenant. TENANT_API_KEY (shown once): $TENANT_API_KEY"
  elif [[ "$http_code" == "409" ]]; then
    echo "Tenant already exists; set TENANT_API_KEY to proceed." >&2
    exit 1
  else
    echo "Failed to create tenant (HTTP $http_code): $json" >&2
    exit 1
  fi
}

validate_payload() {
  echo "Validating payload against latest schema: POST /metadata/validate"
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    -H "$(auth_header "$TENANT_API_KEY")" \
    -H "content-type: application/json" \
    --data-binary @"$PAYLOAD_FILE" \
    "$API_BASE/metadata/validate"

  echo "Validating payload against schema version $SCHEMA_VERSION: POST /metadata/validate/$SCHEMA_VERSION"
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    -H "$(auth_header "$TENANT_API_KEY")" \
    -H "content-type: application/json" \
    --data-binary @"$PAYLOAD_FILE" \
    "$API_BASE/metadata/validate/$SCHEMA_VERSION"
}

store_payload() {
  echo "Storing metadata: POST /services/metadata/$SERVICE_NAME"
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    -H "$(auth_header "$TENANT_API_KEY")" \
    -H "content-type: application/json" \
    --data-binary @"$PAYLOAD_FILE" \
    "$API_BASE/services/metadata/$SERVICE_NAME"

  echo "Fetching metadata back: GET /services/metadata/$SERVICE_NAME"
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    -H "$(auth_header "$TENANT_API_KEY")" \
    "$API_BASE/services/metadata/$SERVICE_NAME"
}

main() {
  if [[ ! -f "$PAYLOAD_FILE" ]]; then
    echo "PAYLOAD_FILE not found: $PAYLOAD_FILE" >&2
    exit 1
  fi

  create_tenant_if_needed
  validate_payload
  store_payload

  echo "Done."
}

main "$@"
