#!/bin/sh
# Run from the board checkout, using the same Compose file(s) as the operator.
set -eu
umask 077
if [ "$#" -ne 4 ]; then
  echo 'Usage: sh scripts/backup-board.sh compose PROJECT BOARD_TITLE DIRECTORY | service SERVICE BOARD_TITLE DIRECTORY' >&2
  exit 2
fi
mode=$1
source_name=$2
board=$3
parent=$(CDPATH= cd -P "$4" && pwd -P)
case "$mode" in
  compose)
    # Inspect only the connection coordinates inside the selected app. Credentials
    # never cross into the host shell or the container command's arguments.
    database=$(docker compose -p "$source_name" exec -T app node -e '
      let url;
      try { url = new URL(process.env.DATABASE_URL); }
      catch { console.error("The selected app has no usable database URL."); process.exit(1); }
      const name = decodeURIComponent(url.pathname.slice(1));
      if (!["postgres:", "postgresql:"].includes(url.protocol) ||
          url.hostname !== "db" || (url.port && url.port !== "5432") ||
          url.search || url.hash || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        console.error("Use a private libpq service for this app database.");
        process.exit(1);
      }
      process.stdout.write(name);
    ')
    pg() { docker compose -p "$source_name" exec -T -e PGUSER=postgres -e PGDATABASE="$database" db "$@"; }
    ;;
  service)
    pg() { PGSERVICE="$source_name" "$@"; }
    ;;
  *) echo 'Choose compose or service.' >&2; exit 2 ;;
esac

dir=$(mktemp -d "$parent/board-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXXXX")
cleanup() {
  # Only these known files in our newly allocated directory belong to this run.
  rm -f "$dir/archive.partial" "$dir/contents.txt" "$dir/source.json" "$dir/sha256.txt"
  rmdir "$dir" 2>/dev/null || :
}
trap cleanup 0
trap 'exit 1' HUP INT TERM

pg psql -X -qAt -v ON_ERROR_STOP=1 -v expected_board="$board" > "$dir/source.json" <<'SQL'
select json_build_object('database', current_database(), 'server', inet_server_addr(),
  'port', inet_server_port(), 'board', "platformTitle", 'setupAt', "setupCompletedAt",
  'vectorSchema', (select extnamespace::regnamespace::text from pg_extension where extname = 'vector'),
  'checkedAt', clock_timestamp()) from public.settings
where id = 1 and "setupCompletedAt" is not null and "platformTitle" = :'expected_board';
SQL
if [ ! -s "$dir/source.json" ]; then
  echo 'The selected database does not contain the expected configured board.' >&2
  exit 1
fi
pg pg_dump -Fc -Z 6 > "$dir/archive.partial"
pg pg_restore --list < "$dir/archive.partial" > "$dir/contents.txt"
# Listing reads only the table of contents. Read every archived data block too.
pg pg_restore --file=/dev/null < "$dir/archive.partial"
if command -v sha256sum >/dev/null 2>&1; then
  digest=$(sha256sum < "$dir/archive.partial")
else
  digest=$(shasum -a 256 < "$dir/archive.partial")
fi
printf '%s  feedbackland.dump\n' "${digest%% *}" > "$dir/sha256.txt"
mv "$dir/archive.partial" "$dir/feedbackland.dump"
trap - 0 HUP INT TERM
printf '%s\n' "$dir"
