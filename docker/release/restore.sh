#!/usr/bin/env bash
# Restores a PHR backup created by backup.sh into a running release compose
# stack. Run from the same directory as docker-compose.yml, after
# `docker compose up -d` has brought postgres/api up (fresh or existing).
#
# Usage: ./restore.sh <backup-dir>
#   backup-dir must contain db.sql and media.tar.gz, as produced by backup.sh.
#
# WARNING: this overwrites the current database contents (db.sql is a
# --clean dump, so it drops existing objects before recreating them) and the
# current contents of /app/media in the api container. Make sure this is
# the instance you intend to restore into.

set -euo pipefail

BACKUP_DIR="${1:?Usage: ./restore.sh <backup-dir>}"

if [[ ! -f "$BACKUP_DIR/db.sql" || ! -f "$BACKUP_DIR/media.tar.gz" ]]; then
  echo "Error: $BACKUP_DIR must contain both db.sql and media.tar.gz" >&2
  exit 1
fi

echo "This will overwrite the current database and media in this stack."
read -r -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring database..."
docker compose exec -T postgres psql -U phr -d phr < "$BACKUP_DIR/db.sql"

echo "Restoring media..."
docker compose exec -T api sh -c 'rm -rf /app/media/* /app/media/.[!.]* 2>/dev/null || true'
docker compose exec -T api tar -xzf - -C /app/media < "$BACKUP_DIR/media.tar.gz"

echo "Done. Restart the stack to pick up any cached state: docker compose restart api web"
