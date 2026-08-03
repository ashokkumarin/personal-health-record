#!/usr/bin/env bash
# Backs up the PHR database and uploaded media for the release compose stack.
# Run from the same directory as docker-compose.yml (i.e. where you did
# `docker compose up -d`).
#
# Usage: ./backup.sh [output-dir]
#   output-dir defaults to ./backups/<timestamp>/

set -euo pipefail

OUT_DIR="${1:-backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

echo "Backing up database..."
docker compose exec -T postgres pg_dump -U phr --clean --if-exists phr > "$OUT_DIR/db.sql"

echo "Backing up media..."
docker compose exec -T api tar -czf - -C /app/media . > "$OUT_DIR/media.tar.gz"

echo "Done. Backup written to $OUT_DIR/"
echo "  - db.sql        (plain SQL dump, restorable with psql)"
echo "  - media.tar.gz  (uploaded documents/thumbnails/avatars)"
echo ""
echo "Keep this directory somewhere other than the host it was taken on."
echo "See docs/backup-and-restore.md for the restore procedure."
