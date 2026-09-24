# Switching to a new Neon database

Steps for moving prod's data to a different Neon project/connection string (new
Neon project, storage limit hit, credential rotation, etc.) and pointing Render at
it. Postgres client tools required locally: `pg_dump`, `pg_restore`, `psql` (on
this machine: `E:\PostgreSQL\18\bin\`).

Never commit a real connection string anywhere in this repo — Render holds
`DATABASE_URL` as `sync: false` (see `render.yaml`), and the only other copy lives
commented at the top of `backend/.env`, for local one-off admin commands only.

## 1. Check the target is compatible before touching anything

```bash
psql "<NEW_URL>" -c "\dt" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
psql "<SOURCE_URL>" -c "SELECT version();" -c "SELECT extname, extversion FROM pg_extension;"
```

The target should come back empty (`Did not find any tables.`). If it already has
tables, stop and confirm with whoever asked for this — the restore step below does
not drop anything first, so leftover objects can collide with the incoming schema.
Note the source's Postgres version and extensions; a target on a materially older
Postgres version, or missing an extension the dump uses (this app only needs
`uuid-ossp`), will fail partway through restore.

## 2. Dump and restore

Dump to a local file **outside the repo** (it contains full user data — password
hashes, PII, everything) and delete it once restored.

```bash
pg_dump "<SOURCE_URL>" -Fc --no-owner --no-privileges -f fatexia_dump.dump
pg_restore -d "<NEW_URL>" --no-owner --no-privileges fatexia_dump.dump
rm fatexia_dump.dump
```

`--no-owner --no-privileges` skips `ALTER OWNER`/`GRANT` statements tied to
role names that may not exist identically in the new project.

## 3. Verify before switching anything over

```bash
psql "<SOURCE_URL>" -c "SELECT count(table_name) FROM information_schema.tables WHERE table_schema='public';" -c "SELECT count(id) FROM migrations;"
psql "<NEW_URL>"    -c "SELECT count(table_name) FROM information_schema.tables WHERE table_schema='public';" -c "SELECT count(id) FROM migrations;"
```

Both counts (table count, `migrations` row count) must match exactly. If they
don't, do not point Render at the new database yet.

## 4. Point Render at the new database

Render dashboard → **both** `fatexia-api` and `fatexia-tracker` → Environment →
`DATABASE_URL` → paste the new pooled URL (the one with `-pooler` in the host).
**Both services need the identical value** — one on the old DB and one on the new
one means clicks and the admin panel are silently reading/writing different
databases. Saving triggers a redeploy of both automatically.

## 5. The pooler/advisory-lock failure mode

`backend/scripts/migrate-prod.js` takes a Postgres advisory lock
(`pg_advisory_lock`/`pg_advisory_unlock`) so the API and Tracker don't race each
other's migrations on simultaneous deploy. Advisory locks are **session-scoped**,
but `DATABASE_URL` is Neon's pooled endpoint (PgBouncer transaction mode), which is
free to hand the lock call and the later unlock call to two different backend
sessions. When that happens the unlock silently no-ops, the lock stays held on
whatever session acquired it, and that session goes back into Neon's connection
pool to be handed to some unrelated later connection — wedging every future
deploy's lock wait forever, since nothing will ever release it.

The script now avoids this by taking the lock over Neon's **direct** (non-pooled)
host instead — same connection string with `-pooler.` removed — which pins that
one `Client` to a single real backend session for its whole lifetime. If this
still shows up (e.g. after reverting that change), the symptom is a deploy stuck
forever at `[migrate] waiting for the migration lock…`, or a crash right after
`lock acquired, running migrations` (we saw a `3F000 invalid_schema_name` crash
from exactly this once). To recover:

```bash
psql "<NEW_URL>" -c "SELECT locktype, objid, granted, pid FROM pg_locks WHERE locktype='advisory';"
# objid 4718241 is migrate-prod.js's LOCK_KEY
psql "<NEW_URL>" -c "SELECT pg_terminate_backend(<pid>);"
```

Terminating the stuck backend rolls back whatever uncommitted transaction it was
holding and releases the lock. Re-run the verification counts from step 3
afterward to confirm the database is still consistent before retrying the deploy.

## 6. After switching

- Keep the old database around for a while as a rollback path — don't delete it
  right after switching.
- Optionally update the commented `DATABASE_URL` line at the top of
  `backend/.env` to the new URL, so future local one-off admin commands
  (`migration:run` against prod, etc.) hit the right database.

## Alternative: a genuinely empty database, no old data to carry over

Skip steps 2–3 (dump/restore) entirely and build the schema from the migration
files instead — this is the right path when the new database doesn't need to
inherit prod's existing rows (e.g. a real fresh start, not a project move).
Run from a laptop, since the Render shell is a paid feature:

```bash
cd backend
DATABASE_SSL=true DATABASE_URL='<NEW_URL>' npm run migration:run
DATABASE_SSL=true DATABASE_URL='<NEW_URL>' \
  SUPERADMIN_EMAIL=you@yourdomain.com SUPERADMIN_PASSWORD='<strong>' npm run seed:prod
```

Migrations first — `seed:prod` fails on a missing `users` table. Leave `NODE_ENV`
unset (setting it to `production` makes `env.ts` demand `JWT_*`/`CORS_ORIGIN` just
to seed). An inline `DATABASE_URL` beats `backend/.env`'s because `dotenv` never
overrides an already-set variable, so this can't hit the wrong database by
accident. `seed:prod` is idempotent and creates no business data — just the first
admin, the `network_settings` singleton, and the fixed `integrations`/
`email_templates` rows the Admin portal can edit but not create. Full detail in
`DEPLOYMENT.md`'s "Bootstrapping a fresh database" section.

Then continue from step 4 above (point Render at it).

## Alternative: build schema via migrations, then load data only

A middle path between the two above: build the new database's schema by actually
running the app's migrations (so it's guaranteed to match the current codebase
exactly, rather than whatever schema state the source dump happened to be in),
then copy over just the rows.

```bash
cd backend
DATABASE_SSL=true DATABASE_URL='<NEW_URL>' npm run migration:run
```

This also creates and populates the `migrations` table correctly on its own —
don't overwrite it with the source's copy in the next step:

```bash
pg_dump "<SOURCE_URL>" -Fc --data-only --exclude-table=migrations -f fatexia_data.dump
pg_restore -d "<NEW_URL>" --data-only --disable-triggers fatexia_data.dump
rm fatexia_data.dump
```

`--disable-triggers` skips FK-constraint checks during the load, since a
data-only restore inserts rows without necessarily respecting dependency order
the way the full dump/restore's combined schema+data TOC does. `pg_dump` still
emits `setval()` calls for each table's ID sequence as part of the data section,
so auto-increment IDs keep working after the load — no manual sequence fixup
needed. Verify with the same counts as step 3, then continue from step 4.
