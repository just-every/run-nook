# Move a Campfire workspace into Nook

Nook reads the archive on your device. Source authentication stays there; only
the reviewed normalized history and selected files are uploaded. Choose the
source namespace and mappings, use **Preview exact import**, accept the named
omissions, then choose **Create dry run**. Review the door's counts, rejections
and differences before **Apply reviewed plan**. A dry run expires after 30
minutes. If an audience or source changes, create a fresh dry run. The history
provides status, reconciliation and guarded Undo, including imports made before
the shared door. A native edit or later work refuses destructive undo.

For another snapshot of the same workspace, keep its source namespace and select
**Compare with the previous import in this source namespace**. Unchanged records
stay in place; source records absent from the new snapshot remain in Nook.

Business imports use the same door. The owner can enable them in Import history
and permanently revoke signing keys; switching access on again keeps revocations.
Workspace archives retain import batches and custody; restoring an archive
leaves Business imports disabled.


An active Nook owner opens **Import history → Import Campfire history** at
`/imports?source=campfire`. Upload the source administrator’s consistent backup,
map its people to existing Nook accounts, inspect every room’s audience and file
hash, then approve the exact plan. No provider account or connection is needed.

## Supported backup

This release supports the official Basecamp **Campfire Express** backup format
1 (`implementation: "once-campfire-express"`), bootstrap SQLite schema, as shipped
by upstream package 0.1.0 at commit
`bb70a7d478160c016393d981e3538987247d3b3d`. Its empty `schema_migrations` ledger is
part of that schema; Nook checks the complete schema inventory, not a guessed
Rails version. The official Rails Campfire repository links this implementation.

Stop source writes and file lifecycle work before running the upstream
`./bin/backup.js` command. Upload its unmodified `tar.gz`: it contains
`storage/backup.json`, the consistent `storage/db/production.sqlite3` snapshot,
and the original files under `storage/files/`. Nook verifies gzip/tar boundaries,
paths, the source declaration, SQLite integrity, references, memberships and
original file lengths and checksums before retaining the upload. Missing bytes,
ambiguous memberships, other schemas and Rails-style backup layouts are refused;
they are never approximated as a successful migration.

The admitted envelope is 32 MiB compressed, 64 MiB expanded, 5,000 archive entries,
a 200:1 expansion ratio, 50 rooms and 100,000 rows per source table. Individual originals may be up to
16 MiB, with safe names and their actual MIME types. Limits refuse the complete
backup before publication; no selected record is silently discarded. Office and
other original files remain downloads; this does not add native upload or preview
formats. Larger sources need a separately supported reader version.

The committed genuine test-instance backup and its upstream generation steps are
in `tests/campfire-import/fixtures/`. Its people, open/closed rooms, two-person and
group DMs, messages and uploads were created through the actual source HTTP doors.
The original saved rich text, timestamps and file hashes are reconciled through
Nook’s public import and conversation doors in the NOOK-044 journey.

## Map people without importing authority

Map every source participant explicitly and injectively to an active Nook full
member. A source administrator, password, session or bot credential never creates
a Nook account or grants an owner/admin role. Nonparticipant historical authors
may remain external. Imported posts keep their source names, IDs, saved rich text,
times and provenance; associations do not turn them into native posts by those
people. Source authentication fields never enter imported author records.

Open rooms remain public channels. Closed rooms remain private channels. Direct
rooms retain their exact mapped participant set and fixed DM roster, including
group DMs. The mapped source room creator is its participant manager/custodian;
the importing owner receives no extra membership. Imported file rows use that
participant custodian for native file custody; original authors and relationships
remain in source provenance. Ordinary private reads still require membership.

This source version has no native reply/parent relationship. Nook preserves its
messages and original rich text without inventing threads. Unsupported embedded
rich-text attachments or relationships are refused rather than flattened away.
The preview reconciles every admitted record and file SHA-256. It also names
filesystem metadata and other source exclusions. Review and accept the exact
omission list before approval; credentials and source-only operational state stay
out of conversation history. The raw backup remains in private owner custody.

## Apply, resume and undo

Approval binds the exact source, namespace, identity decisions, audiences and
file hashes. Changing any of them requires a fresh preview. Nook uses the same
reviewed import pipeline, original custody, provenance and durable checkpoints as
its Slack importer. Source history stays hidden until reviewed publication and
creates no unread activity, notifications, accepted commitments or native events.

Closing the page or losing an acknowledgement does not lose the checkpoint.
Reopen this page and use **Resume**; a repeated apply of the same reviewed plan
cannot create duplicate rooms, messages or files. Current owner authority and
reviewed participant versions are checked again before forward work.

**Undo this import** removes only unchanged records owned by that exact import.
Later native messages, outcomes, audience changes and other dependent activity
block removal. The progress panel explains that the imported history remains;
it never deletes later work to force undo. An unchanged import can be reversed,
including its original private files, while other imports and native messages
remain. Normal owned backups preserve completed import mappings and custody.
