# Genuine Campfire Express backup

`once-campfire-express.tar.gz` is the unmodified output of the official Basecamp
Campfire Express backup command, generated on 19 October 2026. It is synthetic
test content created in the real upstream application through its HTTP routes;
it was not assembled by inserting rows or constructing a replacement schema.

Source: https://github.com/basecamp/once-campfire-express

- Commit: `bb70a7d478160c016393d981e3538987247d3b3d`
- Package version: `0.1.0`
- Pinned Rails reference: `659f95748a115a360a37db9bf80a5361a560e14f`
- Runtime used: Node 26.0.0 on arm64 macOS; `WEB_WORKERS=1`
- Backup format: `1`, implementation `once-campfire-express`

The Rails Campfire README explicitly links this Basecamp implementation. This
fixture exercises the Express backup variant, not the Rails release backup
layout. The source checkout was removed after generation; no source code was
modified and no upstream application remains running.

## Contents and reconciliation

There are 4 people, 5 rooms, 15 memberships, 10 messages, 10 Action Text bodies,
3 original uploaded files and 3 message-to-file relationships. Sessions, boosts,
push subscriptions and webhooks contain no live rows.

| Room | Kind | Source participants |
| --- | --- | --- |
| All Talk (1, created by first-run) | Open | Maya (1), Leo (2), Aisha (3), Sam (4) |
| Project Lantern (2) | Open | Maya (1), Leo (2), Aisha (3), Sam (4) |
| Budget planning (3) | Closed | Maya (1), Leo (2) |
| Room 4 (unnamed) | Direct | Leo (2), Aisha (3) |
| Room 5 (unnamed) | Direct | Maya (1), Leo (2), Aisha (3) |

Sam is unrelated to every closed/direct room. Maya is the administrator but is
not a participant in room 4. Generation checked both cases through upstream
HTTP: private message reads redirected to `/` without exposing history.
`population.json` records the source content sent through HTTP, IDs and ACL
checks. `manifest.json` records archive/snapshot hashes, exact counts, audiences,
archive member inventory and original-file SHA-256 hashes. The files total 196
bytes; their upstream base64 MD5 checksums were also checked against the bytes.
SQLite `integrity_check` returned `ok`; `foreign_key_check` returned no rows.

## Reader details

The archive's consistent snapshot is `storage/db/production.sqlite3`, created by
the upstream `./bin/backup.js` using `VACUUM INTO` while the application was stopped.
It also includes `storage/db/jobs.sqlite3`, `storage/backup.json`, and originals
under `storage/files/<key[0:2]>/<key[2:4]>/<key>`. No fixture bytes were rewritten
after the upstream backup command returned.

**This upstream implementation creates an empty `schema_migrations` table.** Do
not call this a Rails migration version or invent one. `schema.json` is the exact
SQLite schema inventory read from the resulting snapshot, including the index
added by upstream initialization. `manifest.json` declares the source commit and
schema inventory digest. A reader must explicitly admit this implementation and
its actual schema shape; it must refuse unsupported or inconsistent structures.

Room types are `Rooms::Open`, `Rooms::Closed`, `Rooms::Direct`. Message content
is in `action_text_rich_texts` (`record_type='Message'`, `name='body'`), joined by
`record_id`. Files use `active_storage_attachments` (`record_type='Message'`,
`name='attachment'`) joined to `active_storage_blobs`. Source `created_at` values
include six fractional digits and are UTC. This source supplies no native reply
or thread-parent field. The originals are plain text/CSV to exercise upload
custody without media-processing requirements.

Each synthetic user's password was a fresh random value held only in the
generator's memory. Plaintext passwords, application signing secret and cookies
were never written to a fixture file. The genuine snapshot retains the source's
bcrypt password digests and synthetic account join code; these are source-only
test-instance data, not Nook credentials. All users logged out before shutdown.
Readers must never import authentication fields or reuse source passwords.

## How it was made

1. Clone the source shallowly outside the Nook repository and check out the exact
   commit above. Read its `AGENTS.md`. Run `npm ci --ignore-scripts --no-audit
   --no-fund` in that isolated checkout. No application assets are needed for
   the real HTTP write routes exercised here.
2. Use an empty isolated storage directory. Start upstream with `WEB_WORKERS=1`,
   `BIND=127.0.0.1`, `HTTP_PORT=25543` and `CAMPFIRE_STORAGE_PATH` set to it. Set
   `SECRET_KEY_BASE` in process memory, without printing it:

   ```sh
   nice -n 15 node -e 'process.env.SECRET_KEY_BASE=require("node:crypto").randomBytes(64).toString("hex"); import("./src/server.js");'
   ```

3. With those environment variables applied to the upstream process, run this
   directory's `populate.mjs` using Node. It uses `/first_run`, the join link
   exposed by `/account`, `/rooms/opens`, `/rooms/closeds`, `/rooms/directs`,
   multipart/JSON `/rooms/:id/messages`, and `DELETE /session`. All application
   mutations go through upstream HTTP. Passwords/cookies remain in memory.
4. Stop only the upstream server PID that you started and wait for it to exit.
   From its checkout run:

   ```sh
   nice -n 15 node ./bin/backup.js /absolute/path/to/once-campfire-express.tar.gz
   ```

   Keep `CAMPFIRE_STORAGE_PATH` pointing at the populated isolated directory.
5. Read the resulting archive without changing it; reconcile SQLite counts,
   relationships and file hashes, then remove the isolated checkout/storage.

Regeneration produces different timestamps, random storage keys, password hashes
and archive hashes. The checked-in archive is the captured source evidence;
its manifest describes those particular bytes.

`source-messages.json` records the saved message IDs, room/author IDs, original
timestamps and canonical rich text directly from the unmodified backed-up SQLite
snapshot. It contains no authentication columns. The NOOK-044 journey compares
against these actual saved rows, including upstream HTML canonicalization.
