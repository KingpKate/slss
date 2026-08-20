#!/usr/bin/env bash
set -euo pipefail

# No Docker/Testcontainers is required for this gate. It validates the same
# JDBC target used by the local Tomcat deployment and checks Flyway state.
JDBC_URL="${SLSS_JDBC_URL:-jdbc:mysql://127.0.0.1:3306/slss_local}"
DB_HOST="${SLSS_DB_HOST:-127.0.0.1}"
DB_PORT="${SLSS_DB_PORT:-3306}"
DB_NAME="${SLSS_DB_NAME:-slss_local}"
DB_USER="${SLSS_DB_USER:-slss_user}"
DB_PASSWORD="${SLSS_DB_PASSWORD:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Set SLSS_DB_PASSWORD before running the local MySQL gate" >&2
  exit 2
fi

MYSQL_PWD="$DB_PASSWORD" mysql --protocol=tcp -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" \
  -Nse "SELECT VERSION(), COUNT(*) FROM flyway_schema_history; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM scan_tables;"
echo "Local MySQL connectivity and schema smoke check passed for $JDBC_URL"
