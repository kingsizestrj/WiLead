#!/usr/bin/env bash
# Daily backup of the WiLead database, run by cron:
#   0 3 * * * /home/voltec/wilead/deploy/backup.sh >> /home/voltec/backups/backup.log 2>&1
# Keeps the last KEEP_DAYS days of wilead-*.sql.gz in BACKUP_DIR.
# Restore: gunzip -c FILE | docker compose exec -T db psql -U hotspot hotspot
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/wilead-$(date +%Y%m%d-%H%M).sql.gz"
trap 'rm -f "$file.tmp"' EXIT

docker compose --project-directory "$DIR" exec -T db pg_dump -U hotspot hotspot | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$BACKUP_DIR" -name 'wilead-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
