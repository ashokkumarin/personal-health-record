# Backup & Restore

PHR keeps all of your data on the host you run it on — there's no managed
cloud backup happening on your behalf. This page covers what to back up, how
to do it, and how to recover a fresh host from a backup.

There are exactly two things that hold your data:

1. **The Postgres database** — accounts, families, patients, and record
   metadata.
2. **The media store** — the actual uploaded files (documents, thumbnails,
   avatars), at `/app/media` inside the `api` container. By default this is
   the `phr-media` named Docker volume; if you followed the README's tip to
   bind-mount it to `./data/media` instead, that host folder *is* your media
   store and can be backed up like any other folder.

If you lose either one, you lose data — the database without the media is a
list of records pointing at files that no longer exist, and the media
without the database is a folder of anonymous files with no way to tell
whose they are or what they're for.

## Quick backup (recommended)

From the same directory as your `docker-compose.yml` (where you ran
`docker compose up -d`):

```bash
curl -fsSLO https://raw.githubusercontent.com/ashokkumarin/personal-health-record/main/docker/release/backup.sh
chmod +x backup.sh
./backup.sh
```

This writes `backups/<timestamp>/db.sql` (a plain SQL dump) and
`backups/<timestamp>/media.tar.gz` (a tarball of everything under
`/app/media`). Copy that directory somewhere other than the host it was
taken on — a backup that lives on the same disk as the data it protects
doesn't protect against disk failure.

Run this on a schedule (a weekly cron job calling `backup.sh` is enough for
most homelab setups) rather than only remembering to do it once.

## Restoring

On the target host, with `docker-compose.yml` and `.env` in place and the
stack started (`docker compose up -d` — a fresh stack is fine, it doesn't
need to already have your data):

```bash
curl -fsSLO https://raw.githubusercontent.com/ashokkumarin/personal-health-record/main/docker/release/restore.sh
chmod +x restore.sh
./restore.sh /path/to/backups/<timestamp>
```

This restores the database (the dump is a `--clean` dump, so it drops
existing tables before recreating them — safe against a fresh stack, and
intentional if you're rolling an existing instance back to an earlier
backup) and replaces the contents of `/app/media` in the `api` container
with the backed-up media.

## Full disaster recovery walkthrough

Starting from nothing (new machine, or the old one is gone):

1. Install Docker and Docker Compose on the new host.
2. Follow the README's ["Running from published
   images"](../README.md#running-from-published-images-recommended-for-homelab-use)
   quickstart to fetch `docker-compose.yml` and `.env.example`, then
   `cp .env.example .env` and fill in `JWT_SECRET`, ports, and the
   `*_PUBLIC_URL`/`*_ORIGIN` values for the new host.
3. **Do not skip `JWT_SECRET`** — if you're restoring onto a new host, use
   the *same* `JWT_SECRET` your old instance used, or every existing user's
   session/login will be invalidated. If you don't have the old value, that's
   fine, just expect everyone to need to log in again.
4. `docker compose up -d` to bring up a fresh (empty) stack.
5. Run `restore.sh` against your most recent backup, as above.
6. Verify: log in with an existing account, confirm a known record shows up
   in the timeline and its file/thumbnail loads correctly.
7. Point your router/reverse proxy/DNS at the new host if its address
   changed, and update `API_PUBLIC_URL`/`WEB_ORIGIN` in `.env` to match if
   needed, then `docker compose up -d` again to apply.

## Manual approach (without the scripts)

If you'd rather run the commands yourself:

```bash
# Database dump
docker compose exec -T postgres pg_dump -U phr --clean --if-exists phr > db.sql

# Media backup
docker compose exec -T api tar -czf - -C /app/media . > media.tar.gz

# Database restore
docker compose exec -T postgres psql -U phr -d phr < db.sql

# Media restore
docker compose exec -T api sh -c 'rm -rf /app/media/* /app/media/.[!.]* 2>/dev/null || true'
docker compose exec -T api tar -xzf - -C /app/media < media.tar.gz
```

If you bind-mounted media to a host folder instead of using the named
volume, back that folder up directly (e.g. `tar`, `rsync`, or your normal
file-level backup tool) instead of the `tar`-through-`docker-compose-exec`
step above.
