# Nook operations

`rer` provides Node 22.20.0 and pnpm 10.12.4 for this checkout; install neither
yourself. Every operation goes through
`rer VERB` (also `pnpm run VERB`); README.md gives the journey
and `rer describe` the flags. The guided installer
(`node scripts/install.mjs`) runs the same lifecycle from
`scripts/installer/local-setup.json`, generated from the hosted `rer-setup.json`
with local outbox inputs in place of production mail credentials.

## Local installation

`setup` generates `SESSION_SECRET` and `SETUP_TOKEN`, takes the explicit
`OWNER_EMAIL`, and saves `AUTH_ORIGIN`, `AUTH_LOCAL`, `MAIL_PROVIDER` and
`MAIL_FROM` in owner-only `.dev.vars`. A rerun keeps those bytes and the owner;
a different owner or origin refuses with exit 4. Never print `.dev.vars` or put
its values in a report. Local sign-in uses the Base development outbox at
`/__dev/outbox`, which checks the configured origin, Host and Fetch Metadata,
answers only a request that holds this checkout's dev key (`.rer/local/dev-key.env`)
and is unavailable remotely. `rer dev` opens signed in through a dev session (Nook's
personas are `admin`, `member` and `guest` at `@dev.localhost`); `--login` uses the same automatic owner entry. Health reads the operator-auth and outbox tables before
reporting ready. The first owner sign-in lands on `/setup`; confirming it there
is stored in D1 (`oa_first_run`) and survives setup reruns.

`doctor` checks local settings from `.dev.vars` and the owner-deploy inputs
from the shell. After a local setup it exits 3 and names only
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` and the production mail inputs
until you supply them for a deploy.

Every request checks its own session and the current conversation membership.
A channel owner changes membership; new members see the channel's full history.
DMs have fixed participants. Owner and admin roles never open other people's DMs.

## Owner-account deploy

`deploy --dry-run` builds and validates the Worker, assets, every migration and
`owner-deployment.json` with no provider request. `deploy` needs
`CLOUDFLARE_ACCOUNT_ID` and a scoped `CLOUDFLARE_API_TOKEN` in the shell, plus
`MAIL_FROM` and `SENDGRID_API_KEY` on the first deploy; `OWNER_EMAIL` defaults to
the setup owner. It stages the build and migrations under `.rer/deploy/product`
and runs rer's deploy-kit owner controller: find-or-create the D1 database and
Worker named after the project, apply pending migrations, upload, set secrets and
check `/health`. rer supplies the production `SESSION_SECRET` and a one-time
`SETUP_TOKEN` itself; nothing secret is kept in the checkout. `/health`
answers with the deploy identity (`deployment.sourceSha`, `fingerprint`,
`versionId`) that deploy compares, and the Worker hands built files to the
deploy's assets before any route (Base's `staticAssetResponse`), so they load
behind `run_worker_first`; `rer verify` serves the build that way and fails on
any built file that does not answer 200. Only the
account credentials and the declared secrets reach the controller. After health
passes, `rer deploy` claims the production owner by posting the setup token to
`/auth/bootstrap` (303 creates the owner; an owner that already exists is kept),
removes the token from the Worker, records that and checks health again; a later
deploy no longer declares it, and the runtime runs without it once an owner exists.
The owner signs in by email. `rer deploy --remove --yes` deletes what the deploy
created for the environment; update is `git pull --ff-only` then `rer deploy`.
Production auth requires the
exact HTTPS origin, `AUTH_LOCAL=false`, SendGrid mail and Cloudflare's
`CF-Connecting-IP`; the development outbox does not exist there.


## Email notifications

C14 in CONTRACT.md is the delivery contract. What an operator needs to know:

- **Sender.** Notification email uses the same sender as sign-in mail:
  `MAIL_PROVIDER`, `MAIL_FROM` and the provider key in the owner deployment
  (`MAIL_API_KEY`, populated from the `SENDGRID_API_KEY` deploy input for the
  SendGrid default). Under
  `rer dev` and `rer preview` mail goes to the development outbox
  (request a link at `/signin` after opening `RER_OPEN`), and owners see "Email sending is not set up"
  in their settings until a real provider is configured.
- **Off by default.** Nothing is emailed until a member turns it on under
  Profile → "Email me when…". Upgrading an installation changes no one's choice
  and queues nothing.
- **What is sent.** Explicit mentions and commitment proposals, material
  revisions and completion reports on one switch; urgent requests on a second,
  with "let urgent requests through quiet time". Emails carry the sender's name,
  the conversation and a link, never message text or file names. Each email has
  a "turn these off" link (`/notify/off`, no session needed) and a link to the
  settings.
- **Delivery.** `nook_notify_queue` (migration 0019) is written with the attention
  rows and drained by the ChatHub Durable Object's alarm, which stays armed while
  rows are pending, so delivery does not depend on an open tab or on the
  scheduled-handler door, and it resumes after a restart. Retries run after 15 s,
  1 min, 5 min, 30 min and 2 h. Sent, cancelled and failed rows are pruned after
  30 days.
- **Failures.** A send being retried or given up shows as "email not delivered"
  with its reason (not set up, refused, rate limited, not confirmed) to the
  recipient, the member whose message caused it and the owner. A send the
  provider did not confirm is not retried, so it can never arrive twice.
- **Limits.** Accepted by the provider is not proof of inbox receipt. Urgent
  requests are in-app requests, not pages; Web Push follows C15; there is no SMS or native
  push. Live delivery through a real provider has not been proven; see
  ACCEPTANCE.md.
- **Backups.** Archives carry members' choices (`nook_notify_preferences`) and
  exclude the queue, so a restored installation sends nothing old.

## Export, import and reset

`export` and `import` use the copied Base portability engine through
`scripts/local/transfer.mjs`, with live product hooks that validate semantics,
media hashes, private memberships, outcomes, attention and importer receipts
before any restored row is published. Archives exclude sessions, sign-in tokens,
the bootstrap claim, outbox mail and generated settings. Import needs an empty,
stopped destination and `--yes`. `reset --yes` removes exactly the inventory it
lists: local D1 state, `.rer/local`, `.seed/installer` and the generated
`.dev.vars` files.

`rer export --target remote --origin ORIGIN --session-file FILE` exports a
deployed Nook: `scripts/local/remote-export.mjs` drives Base's reviewed
portability door, which the Worker mounts at `/api/portability`
(`src/platform/portability.server.ts`) for exports by an active owner's current
session only; import routes are never authorized there. It writes the same
verified archive and erasure journal as a local export and removes the hosted
export job. Remote import is refused; restore into a new local checkout.

Archives are portability version 2: the closing `archiveHash` binds the whole
manifest and every ordered part, and import verifies it before restoring.
Version 1 archives from earlier Nook builds are refused by a normal import
(`legacy_archive_unverifiable`); upgrade the original installation and export
again. When that installation is gone, use Base's backup-only v1 recovery in a
new checkout that has not run setup:
`rer import --legacy-v1 --input exports/backup-v1.rer --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer`.
It verifies every v1 checksum, restores into the empty installation, records
the unverified-metadata acknowledgement in `rer_portability_recovery_audit` and
writes a fresh v2 archive (and its journal) to keep with your backups; then
recover identities as for any restore. A populated destination is refused. v1
metadata (source identity, export time, erasure journal) cannot be
authenticated; see Base's `modules/portability/README.md#backup-only-v1-recovery`.
`rer import --journal LATER.rer` fences a normal import with the erasure journal
of a later archive of the same installation.

Save archives and their journal sidecars only under the unserved `exports/`
directory or at an absolute path outside the checkout. Export rejects source,
public and build paths even when their filenames end in `.rer`. Move existing
archives out of those paths before starting or building; the build checks its
output for archives, including renamed portability archives. The public local
listener refuses archives, private local state and Cloudflare's local explorer
routes during setup, development and preview. Application runtimes bind to a
separate IPv4 loopback port and keep the public origin for links and cookies.

Files are private downloads of 1 byte to 25 MiB each, five ordered attachments
per message and at most 50 pending uploads per uploader. Bytes live in private R2
and D1 holds metadata and opaque object keys; there is no workspace-wide byte
quota beyond the platform's own limits. Search is indexed, case-insensitive exact
substring matching of at least three characters; history, replay and attention
read indexed pages. Export refuses while an upload, import or deletion is still
pending rather than archive incomplete media; archives carry the actual R2 bytes.

After an import, follow [Restoring a local archive](#restoring-a-local-archive)
before running setup. This includes locating the restored D1 file, taking a
WAL-safe snapshot, recovering every actor and installing the recovered database
at the original binding filename.

## Restoring a local archive

Run these steps from the destination checkout after `rer import`. Keep it
stopped until recovery and replacement are complete. If you already tried
`rer dev` and saw `HTTP 409 (identity_recovery_required)`, stop it and continue
here; importing content deliberately does not authorize a new owner.

1. Stop the app and locate the restored D1 binding file:

   ```sh
   rer dev --stop
   find .wrangler/state/v3/d1/miniflare-D1DatabaseObject -type f -name '*.sqlite'
   ```

   Miniflare may also put `metadata.sqlite` here; it is bookkeeping, not the
   workspace. Inspect the candidates read-only:

   ```sh
   node --input-type=module <<'JS'
   import {readdirSync} from 'node:fs';
   import {DatabaseSync} from 'node:sqlite';
   const directory = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
   for (const file of readdirSync(directory).filter(name => name.endsWith('.sqlite'))) {
     const db = new DatabaseSync(`${directory}/${file}`, {readOnly: true});
     try {
       if (db.prepare("SELECT name FROM sqlite_master WHERE name='nook_storage'").get())
         console.log(`${directory}/${file}`, db.prepare('SELECT authority FROM nook_storage WHERE id=1').get(), db.prepare('SELECT count(*) AS actors FROM nook_actors').get());
     } finally { db.close(); }
   }
   JS
   ```

   Select the file with authority `normalized` and the restored actors. If
   several workspaces match, identify the intended one; do not select by age
   or filename order. Set the path below to that exact file and keep this
   variable for the replacement step.

2. Take a consistent snapshot with Node 22+'s SQLite backup API, which includes
   committed data still in the WAL. Do not copy the live `.sqlite` file with
   `cp`. Use a new private recovery directory on each attempt:

   ```sh
   export NOOK_RESTORE_DB='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/REPLACE-WITH-BINDING-FILENAME.sqlite'
   mkdir -p exports
   mkdir -m 700 exports/identity-recovery
   node --input-type=module <<'JS'
   import {DatabaseSync, backup} from 'node:sqlite';
   const db = new DatabaseSync(process.env.NOOK_RESTORE_DB, {readOnly: true});
   try {
     if (db.prepare('SELECT authority FROM nook_storage WHERE id=1').get()?.authority !== 'normalized')
       throw Error('Select the restored normalized Nook database');
     await backup(db, 'exports/identity-recovery/source.sqlite');
     console.log(JSON.stringify(db.prepare('SELECT id,name,email,role,active FROM nook_actors ORDER BY id').all(), null, 2));
   } finally { db.close(); }
   JS
   ```

   The printed actor list is private. Save `exports/identity-recovery/mapping.json`
   in the `{owner,users:[{id,email,role}]}` format under
   [Identity recovery](#identity-recovery). Include every retained actor,
   including inactive people, with their original IDs and roles and the mailbox
   each person will use. Choose an active owner. Then recover the snapshot:

   ```sh
   node scripts/storage/recover-identities.mjs exports/identity-recovery/source.sqlite exports/identity-recovery/recovered.sqlite exports/identity-recovery/mapping.json
   ```

3. While the app is still stopped, preserve the imported file and its sidecars,
   then put the closed recovered file at **the original D1 binding path**, not
   beside it under a new name. Keep the R2 directory unchanged:

   ```sh
   mv "$NOOK_RESTORE_DB" exports/identity-recovery/imported.sqlite
   if [ -f "$NOOK_RESTORE_DB-wal" ]; then mv "$NOOK_RESTORE_DB-wal" exports/identity-recovery/imported.sqlite-wal; fi
   if [ -f "$NOOK_RESTORE_DB-shm" ]; then mv "$NOOK_RESTORE_DB-shm" exports/identity-recovery/imported.sqlite-shm; fi
   cp -p exports/identity-recovery/recovered.sqlite "$NOOK_RESTORE_DB"
   rer setup --owner-email you@example.com
   rer dev
   ```

   Use the mapped owner's mailbox for setup and the original local port (add
   `--port PORT` to setup if needed). Setup retains the recovered bootstrap claim
   and IDs. Open the new `RER_OPEN` link, confirm **Finish setup** if offered,
   and check conversations, decisions, membership and downloaded file bytes.
   Other recovered people use ordinary sign-in under their retained identities.
   Keep the archive, mapping and recovery files private; do not commit them.

## Upgrading from the single workspace document

Installations created before normalized storage keep their document
authoritative, and the app refuses product requests, until you convert them.
Stop the app, apply the migrations with `rer setup` using the
saved owner, then convert the canonical state:

```sh
node scripts/storage/convert.mjs --paused --persist=.wrangler/state/v3
node scripts/storage/reconcile.mjs --paused --persist=.wrangler/state/v3 --discard-expired
```

The converter can stop after `--stop-after=staging` or `--stop-after=validation`;
running it again resumes. It validates every reference, count and file hash,
retires sessions, switches authority atomically and removes the old document only
on success. Reconciliation retires interrupted uploads while the app is stopped,
retries durable deletions and, with `--discard-expired`, tombstones expired unbound
uploads before deleting their objects.

## Managed packaging, owner claim and editor authority

`rer-project.json` is generated by `node scripts/delivery/project.mjs` from
`scripts/delivery/base/packaging.json` and the exact root `rer-setup.json`
digest. `.github/workflows/rer-managed.yml` is generated by the copied Base
delivery producer and calls `runeditrun/delivery`'s `trusted-build.yml` at a
pinned 40-character commit, the same pin Uptime ships. It runs only on manual
dispatch by the RER management service. `node scripts/build-delivery-artifact.mjs`
produces the schema-2 Worker artifact (modules, assets, the D1, R2 and Durable
Object declarations and every migration); `node scripts/delivery/build-local.mjs`
builds the same bytes from clean committed source into a new local directory.
None of these deploy.

RER Managed Configure reads `management/integration/deployment-spec.json`
directly from the repository. After `rer build`, run `pnpm integration:generate`
to regenerate it with Base's spec reader, the project/setup digest, local setup
manifest and pinned Managed workflow. `pnpm integration:check` fails Verify on
drift against the emitted build. `AUTH_ORIGIN` is assigned by RER through
`surfaces.app.originVariable`. Hosted setup offers SendGrid or Resend and requires
the selected provider's key and a verified sender; each provider key is an
optional deployment secret because only one is used. Local setup needs neither.

A managed installation admits its owner through the signed claim at
`/auth/owner-claim`, mounted before the ordinary auth routes. Trusted runtime
settings supply `RER_OWNER_CLAIM_ISSUER`, `RER_OWNER_CLAIM_INSTALLATION_ID`,
`RER_OWNER_CLAIM_APP_ORIGIN` and `RER_OWNER_CLAIM_PUBLIC_KEYS`; `AUTH_ORIGIN`
must equal the claim's application origin. GET and HEAD only show the
confirmation; POST commits the Base owner bootstrap and the permanent
`oc_owner_claims` ledger in one transaction, so a second claim is refused.
`0012_owner_claim.sql` is the byte-exact Base ledger and
`0013_claim_storage_fence.sql` refuses a claim over restored people that still
need identity recovery. Never put a claim, setup token or cookie in a URL or a
log. The local installer keeps its private bootstrap and outbox sign-in.

The retained editor authority API uses `RER_MANAGEMENT_ORIGIN` and
`RER_INSTALLATION_ID`. Its config and identity routes check the current owner
session on every request; a config lease lasts at most 30 seconds and ends with
the session. Members and visitors get no editor grant. The installed `/` is a
session-independent Lobby with no editor mount. It does not apply
`src/editor/visual-edits.json`; the separate static run site publishes the
product homepage from source.

## Identity recovery

Before recovering an old installation, stop all Nook runtimes and keep the
original directory private. Select the authoritative source explicitly if more
than one old state directory exists. No tool selects the newest or first file.
Old root SQLite archives first use `scripts/archive.mjs convert-sqlite SOURCE
NEW_NATIVE_ARCHIVE`, then `scripts/archive.mjs restore NEW_NATIVE_ARCHIVE
NEW_NATIVE_DB`. Native v2/v3/v4 archives restore through that same legacy boundary.
These commands preserve original IDs, history, bytes and provenance and create
new paths. They never activate old passwords in the new server.

Every retained user, including inactive users, must have an explicit mapping:

```json
{
  "owner": "original-owner-id",
  "users": [
    {"id":"original-owner-id","email":"owner@example.com","role":"owner"},
    {"id":"original-member-id","email":"member@example.com","role":"member"},
    {"id":"original-inactive-id","email":"former@example.com","role":"member"}
  ]
}
```

Use your real IDs and mailboxes. Save this mapping privately. Display names never
establish authority; duplicate names are not coalesced. The chosen owner must be
active. The conversion refuses incomplete mappings, unknown/duplicate IDs,
normalized duplicate mailboxes and conflicts with retained
identity metadata **before creating a destination**. Multiple owner-role
identities are supported and retain their roles; `owner` explicitly selects one
active owner as recovery bootstrap authority. Inactive owners remain inactive:


```sh
node scripts/local/identity-recovery.mjs ORIGINAL.sqlite RECOVERED.sqlite MAPPING.json
```

This is an offline filesystem-operator capability, not an app-admin export.
It validates the complete domain graph, copies to a new SQLite file, adds the
current auth/mail/portability schemas and atomically inserts the exact stable IDs
and bootstrap authority. Only after admission does it remove legacy password
fields and sessions from the recovered workspace. Inactive identities remain
inactive. Original files are retained untouched; unsuccessful recovery removes
only its newly created destination. A populated operator store refuses.

For a current Base portability restore, use the normalized recovery tool and
the exact D1 replacement procedure in
[Restoring a local archive](#restoring-a-local-archive). The legacy tool above
is only for a database that still holds the single workspace document.
Every recovered participant keeps the same stable ID and current membership.
A fresh unrelated owner is never attached to an old identity or conversation.
Retained IDs that have not completed explicit recovery are dormant, not reported
migrated.

Normal data movement uses the copied Base portability engine through
`scripts/local/transfer.mjs`, with real D1 bindings and live function-valued
`exportRow`/`validateStaged` hooks. It excludes operator sessions/tokens/bootstrap,
mail messages and generated settings; nested product credentials are stripped
only after an explicit identity mapping exists. Product semantics, media hashes,
private memberships, outcomes, attention and importer receipts are validated
before any restored product row is published. The older archive engine exists
only as the prior-format conversion/recovery boundary.

## Prior-format offline recovery

Stop the Worker that owns the selected state. Find its SQLite file under the explicit
local D1 persistence directory and use an absent archive/target path:

```sh
node scripts/archive.mjs export PATH_TO_LOCAL_D1_SQLITE ABSENT_PRIVATE_ARCHIVE
node scripts/archive.mjs restore PRIVATE_ARCHIVE ABSENT_D1_SQLITE --dry-run
node scripts/archive.mjs restore PRIVATE_ARCHIVE ABSENT_D1_SQLITE
node scripts/archive.mjs convert-sqlite OLD_ROOT_ARCHIVE ABSENT_NATIVE_ARCHIVE
```

The filesystem operator has access to all private data and legacy password hashes; this is
not an ordinary app-admin export. Native archivev4 excludes live sessions, preserves
intents, outcomes, read frontiers, bytes, attention choices and immutable import
receipts/provenance. Recovery validates checksums and the complete graph before
creating a target. It admits historical rootv1–v4 and nativev2–v3 through explicit
mappings/upgrades. Rehashed malformed media, bindings, scopes and provenance reject.
After restore, place the fresh SQLite file at the matching local D1 database path
in the canonical fresh persistence directory. Complete the explicit identity mapping
below before setup; then authenticate again. Never overwrite an existing database or start two writers on it.

Build and installer preflight refuse legacy `dist/server/.wrangler/state`, dangling
entries and canonical persistence aliases into `dist`. When both legacy and canonical
stores exist, the operator must choose the authoritative stopped state and preserve
both originals before recovery. No automated merge, directory deletion or authority
choice is made. Moving a complete stopped tree retains sessions; an archive restore
intentionally drops them. Retain private backups securely; live logical erasure does
not erase old archives, WAL remnants or physical storage.

## Tests

`rer verify` runs the complete suite. It creates isolated
synthetic workspaces, refuses to run over an existing `.seed`, `.dev.vars` or
`.wrangler/state`, and stops every Worker and browser it starts.
`scripts/workflow-proof.mjs` is the shared two-person workflow those tests drive;
it creates labelled synthetic accounts on an explicit local origin, so never
point it at a real workspace.

`node tests/part6.mjs --platform-root PATH` proves managed packaging, the signed
owner claim, Lobby isolation and editor authority/source persistence against the
platform's source compiler; it
needs that checkout, so verify does not run it.


## Operator erasure and restore journal

Use **Erase message** for an accessible channel message, or **You → Team → Erase member** for an eligible other account. Owners/admins have no operator DM erasure door. Member erasure includes authored DM content. Owners can erase privileged other accounts; admins only accounts with the member role, including guest access. Self and last-active-owner erasure are refused. Preview contains counts only; type `ERASE` to commit.

Erasure removes identity/auth credentials, invitations/outbox copies, personal state, authored message/revision/file content and selected imported copies. Authored decisions/commitments retain scope, kind, version count and state without performing any work transition. Other authors' accepted work retains its state, with erased assignee/action attribution removed. Separate content-free history retains thread positions, opaque structural actor IDs where needed, fixed DM roster/counters and immutable import ownership. Those structural IDs remain correlated. Retry digests preserve send/upload idempotency without storing caller-provided intent text. Event/audit actor and subject references are severed; random receipt IDs map only to counts and times after completion. `src/team/erasure/graph.ts` declares retained exceptions.

The original live message, attachment and actor rows are absent and their real primary keys are fenced through Base portability. D1 removal, transfer invalidation, fences and blob obligations commit together. R2 deletion follows and a receipt stays pending until every blob is verified absent. Background continuation processes bounded chunks while its stored operator session/role remains current; an eligible operator can transfer continuation to their current authority with **Pending erasures → Resume erasure**. Closing the dialog does not cancel accepted work. Uncertain upload attempts deliberately block completion: stop the runtime, run the existing paused `node scripts/storage/reconcile.mjs --paused --persist=.wrangler/state/v3` procedure for the authoritative local state, restart and resume. Never delete its work tables to obtain a completed receipt.

For standalone Slack identities use **Team → Imported authors** as a current owner with access to every affected channel. This composes import-kit's public erasure door with Nook's native cascade. Whole retained raw ZIPs are withdrawn; unrelated authors' visible history and files survive. Erased reviewed intents cannot replay the selected content.

Each stopped `rer export` saves `<archive>.journal.rer` alongside its archive, both private mode 0600. The sidecar's `.rer` suffix is covered by the development/preview file deny policy. Preserve the latest sidecar. To present it to an empty stopped destination:

```sh
NOOK_ERASURE_JOURNAL=exports/latest.rer.journal.rer rer import --input exports/old.rer --yes
```

An explicitly supplied missing, malformed, insecure or unrecognized journal fails closed. Normal imports still require an empty destination. Same-install and post-archive attempts at importing older archives are refused by that guard before the journal check; an empty destination given the latest owner's journal independently enforces recorded erasure. A refused attempt does not persist the supplied journal into an empty destination: supply `NOOK_ERASURE_JOURNAL` again on each later attempt until a post-erasure archive has been successfully restored. A latest post-erasure archive carries the journal and its separate structural tombstones. A virgin installation that never received any later journal cannot recognize an old archive. Do not reset or discard a journal to bypass refusal.

Logical erasure does not rewrite earlier downloaded backups, offline browser copies, provider backup/Time Travel retention, freed database pages or WAL/physical storage. The installation owner remains responsible for retention of those copies. The local public-door measurement on 11 October 2026 erased 10,000 messages and 500 files in 47.77 seconds, from the HTTP request through verified absence of all selected file bytes. This is a measurement on the test Mac, not a hosted capacity claim. The five-minute target covers local D1 and R2 work; Nook has no remote-provider cleanup in this flow. Larger jobs remain pending until all bounded work and files finish.

### Source policy alternatives

`src/team/erasure/policy.ts` owns three installation choices. Rebuild after changing a line; these are not user settings.

- `memberMessageBodies = 'erase'` is the default. Set it to `'retain'` to keep currently displayed native and associated imported message bodies, including DMs, under **Former member**. Revisions, files, identity/profile data, source records, original ZIPs and authored outcome text are still erased. Retained text can contain names and other personal information: this is not anonymity. Separate retained-body tables have matching content-free tombstones and current conversation ACLs. A previously accepted message or imported-author deletion still erases its selected bodies; member retention cannot reverse that accepted deletion. Latest archives retain the other bodies. An authorized later channel-message erasure removes the retained body and fences its own archive key.
- `operatorChannelMessageErasure = true` permits new operator requests for accessible channel messages. Set it to `false` to restrict new message deletion to the native author's Delete action. This also hides operator affordances; staged-file deletion remains available to its uploader. Neither choice grants operator DM access. Already accepted irreversible requests deliberately retain their recorded `authority_class` continuation, with a fresh session, current role and current ACL required on every step. This admission choice does not cancel accepted work.
- `protectEveryOwnerFromErasure = false` preserves self and last-active-owner guards. Set it to `true` to protect every owner-role account, active or inactive, until explicitly demoted or transferred out of that role. Admission, atomic commit, pending continuation and UI enforce this restriction. Base's self/last-owner safeguards remain intact.

A member operation snapshots its body choice when accepted. Rebuilding the source while it is pending cannot turn retention into erasure or erase into retention. Resume uses the stored body choice; it still requires current authority. The stricter owner guard also applies to pending member erasures while the target still has an owner role. Operator pending-message continuation is explicitly recorded authority, not an implicit exception inferred from a missing live message.

Member completion also waits for earlier, already accepted file deletions. The deletion queue now records the file's author until physical absence is verified. For older queue entries whose ownership has already been lost, member erasure conservatively includes those pending deletions too; preview and receipts disclose this. It does not authorize deletion of any additional live file. Verified absence settles every accepted obligation for the same object key, including an earlier author's receipt after that author's credentials have gone.

Pending imported media and whole raw ZIP deletions are conservatively treated as unknown content authorship: an importer is a custody owner, not necessarily the message author. They are already accepted cleanup obligations, not additional erasure targets. Their receipt obligations are inherited even if a separate queue worker has already removed the queue entry. A previous author deletion interrupted immediately after registration moves to file cleanup only when the member cascade actually removes its live content; verified file absence then settles both receipts.

## Web Push and PWA

Migration 0023 adds the push channel without opting anyone in or changing email delivery. Build and deploy the ordinary Worker/assets/migrations; no relay, native shell or store account is required. Use HTTPS outside loopback development. `/manifest.webmanifest`, `/sw.js` and the two Nook icons must be served from this same origin. The service worker has root scope and does not cache requests. In **You**, install Nook, then press **Enable push on this device** and choose categories. iPhone/iPad users must first add Nook to their Home Screen. Conversation follows alone never push. The endpoint allowlist currently covers `web.push.apple.com`, `fcm.googleapis.com` and `updates.push.services.mozilla.com`; other vendors need a reviewed source change, never a caller-supplied relay URL.

The first authenticated device-settings read generates the instance VAPID key pair using Web Crypto. `nook_push_secrets` holds the public key and an AES-GCM sealed private JWK, protected by a domain-separated key derived from the existing SESSION_SECRET. The VAPID contact is `mailto:` plus the configured OWNER_EMAIL. Retain the original SESSION_SECRET securely for this live install; never print or publish it or the private key. Repeated launches reuse the stored key. Normal export deliberately excludes it, subscriptions, presence and pending effects, so restore initializes a fresh key and browsers must register again.

Changing SESSION_SECRET makes the sealed VAPID key unreadable. To deliberately rotate after loss or compromise: stop the installation, preserve an owner-only operational backup, delete only `nook_push_devices`, `nook_push_presence` and `nook_push_secrets` in the authoritative database, cancel remaining pending/retrying push rows, then restart. The first device read generates a new pair; members reopen Nook and enable again. Do not copy subscriptions to a restored installation. Nook compares the subscription's application-server key with its current public key and re-subscribes when allowed. A browser that removes a subscription is reconciled on a foreground launch while permission remains granted; otherwise the member sees the Enable control or a browser-permission explanation. Permission is never requested automatically.

The alarm drains channels independently even with no sockets. Fresh visible-page heartbeat state is the only foreground holdback and expires automatically. Provider acceptance records sent; HTTP 404/410 retires that device. Rate limits and definite server failures retry on C14's schedule; refused requests and redirects stop, and thrown/timeout failures are uncertain and never repeated. Failed/retrying sends appear in **You** to the recipient, sender and owner. No endpoint, subscription key, encrypted packet or Authorization header is logged. A successful device does not repeat when another retries. A queue row marked sending at a stopped Worker is treated as uncertain after its lease.

Every Web Push must show a visible alert. Nook updates supported badges with that alert and synchronizes displayed notifications/badges after foreground authenticated reads. It never sends silent clear-only or badge-only pushes. WebKit explicitly revokes silent subscriptions ([official explanation](https://webkit.org/blog/16535/meet-declarative-web-push/)). Android web launchers may derive a dot from visible notifications rather than exposing an app badge counter. The proposed iOS background badge clears and Android native normal-priority clears require a future native transport; they are not a web delivery guarantee.

For the targeted local proof after `pnpm build:app`, run `pnpm test:push`. Its synthetic HTTPS push endpoint exists only at the network edge inside Miniflare; it creates no provider subscription and makes no vendor request. A real-device push acceptance run is a separate operational gate. See ACCEPTANCE.md before making delivery claims.
