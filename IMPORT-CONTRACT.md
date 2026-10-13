# User-provided history import contract clarification

Status: faithful bounded apply is authorized (2 October 2026 correction). The native edition implements the bounded API policy; the import tests under `tests/` exercise it. The source-only CLI remains implemented.

Preserve supplied exported content, external authorship, exact source timestamps, threads and admitted attachment bytes without automatic redaction or local authorship substitution. Imported source history is immutable. No actor association, channel ownership or import job grants later source editing or deletion powers. That optional feature is separate work; the earlier redaction-authority question is withdrawn. Imports are explicit into new private destinations with user-selected membership, under existing authenticated account/channel-creation authority. No existing-channel audience expansion or new moderation role.

## Authority and research lineage

TARGET requires an authorized uploaded public-channel Slack importer, source IDs,
timestamps/threads, explicit mappings, missing-file/private-data diagnostics and
suppressed historical effects. Combined research section “Privacy, retention,
portability and scale choices” and original Slack report sections “Import and export”
and “Ownership proof” require safe paths, provenance, no display-name account merging,
omission reporting and independent recovery. Astra's permission/adoption analysis
warns that moving an archive is not moving an authorized coordination system.
These are source requirements, not evidence that an importer is implemented.

No API scraping, provider account, URL fetching, credentials, deployment or billing is authorized by this import capability.

## Source authorship and optional local association

Every imported message has an immutable source key: source namespace and workspace ID,
conversation ID and message ID. Preserve the exact source timestamp and thread-root
key, with normalized ordering recorded separately. Do not parse IDs/timestamps into
lossy numeric identity. Preserve explicitly exported edited/deleted status without
inventing unavailable history; missing author/root/file information is diagnosed.

A source actor is an external historical identity, including bots/deactivated or
unknown identities. Its name is a display label, never a login key or deduplication
key. Duplicate display names stay distinct. Imported provenance records external
source actor ID/label and import custodian separately from any local user. UI/search/
exports must distinguish “source export attributes this to X” from “local X posted
this”. Native sessions, passwords, source credentials, membership and roles are not
created or activated from the export.

An explicit source-ID→local-ID association is optional metadata. It is never an
identity merge, proof of external account ownership, actor consent, authorization
to impersonate, edit privilege, approval, accepted commitment or post action. A
local person's later acknowledgement can record that local association only; it
cannot authenticate the historical source account. Never import historical chat
through ordinary send() as if its mapped local account had sent it now.

## Visibility and destination mappings

Only explicitly selected source public channels are candidates for the first
bounded importer. Private channels, DMs and unknown visibility are excluded; do not
silently widen them or flatten them into public history. Omission counts mean only
what this uploaded export exposes; unknown private/export completeness stays unknown.
No omitted private/DM body, actor list, filename or URL is copied into a channel,
ordinary member report, search or attention item. Detailed private diagnostics stay
with the authorized import custodian, under the import's own audience.

Every selected source channel needs an explicit destination and exact local audience.
Source member lists are historical provenance and never local grants. Local channel
history policy still applies: new authorized members can read its full retained
history. Preview must disclose this, the source visibility and proposed audience.
No DM creation/participant expansion, directory access, role grants or administrator
read bypass is inferred. Actual apply must independently authenticate the custodian
and verify current destination write/import authority and audience before each commit.
The current app only has channel-owner membership controls; a future import authority
must be declared explicitly rather than assumed from disk access or an admin label.

## Files and incomplete/unsupported records

No URL fetching or source API calls. Supplied bytes and metadata are untrusted.
A source file key, message binding, original size and hash when supplied, local bytes
hash and completeness outcome are separate facts. Missing hashes mean authenticity/
completeness cannot be established, not “verified”. Current allowed media types,
size/count/workspace caps and forced-download confinement remain admission limits.
Blocked bytes are reported; do not silently truncate, retype, render or replace them.
Validate archive/directory paths before reading: no absolute/parent traversal,
symlink escape, archive bomb or executable content. Supported source-format versions,
metadata/record/byte bounds and exact path/hash checks need declared parser evidence.

Each omitted or blocked eligible public record/file needs a stable opaque source key
and reason: missing bytes, unsupported type, size, malformed record, absent author,
missing root, duplicate/conflicting key, unknown scope or unsupported revision/object.
Unknown private material uses restricted aggregate diagnostics only. Message/file
completeness is never inferred from a successfully parsed messages array. Reactions,
apps, decisions/commitments, presence, old notifications and authentication grants
are not converted into current authoritative product state.

## Deterministic preview, approval, idempotency and recovery

A versioned preview must bind source content and byte digests, parser/policy versions,
namespace, all identity/channel mappings, selected local audience/authority snapshot,
explicitly accepted omissions, limits and target-state preconditions. Canonical ordering
is specified; timestamps or random job IDs cannot change the same preview result.
The preview itself is private data, mode0600 locally, and contains no copied message
bodies/file URLs by default. A plan hash is integrity evidence, not source authenticity.

Apply approval binds that exact plan and audience, not a mutable filename or display
name. Recheck authority/membership and source/target preconditions inside every atomic
batch. Revocation/audience changes pause before further disclosure and require a new
preview, never silently resume under a wider audience. Source IDs plus namespace
identify deduplication; immutable per-record content/binding digests identify conflicts.
The same unchanged source/mapping returns already-imported receipts, not new messages.
A changed source record, remapped identity, changed destination or reused namespace
must be surfaced for an explicit reconciliation plan; never overwrite silently.

Commit historical record/provenance/media binding, deduplication receipt and resume
frontier atomically. Checkpoint is durable data, not a browser/sidecar-file assertion.
Retry after lost acknowledgement queries that receipt before generating another copy.
Imported history never triggers attention, unread activity claims, external bots,
notifications, inferred decisions or accepted work. Conversation replay may record an
opaque import event for catch-up; local original posting order is not rewritten. Such catch-up events must not increase
ordinary unread counts or advance read cursors across any live unread work.

Portable backup must include source identities and provenance, receipts/frontiers, exact
media state and the associated visibility/mapping contract. Resume after independent
restore must reconcile the same source IDs without duplicates. Redacted/tombstoned
local imported records must never be resurrected by retries or a re-uploaded old
export. Minimize audit to opaque facts so redaction does not leave secret body copies.
Deletion/redaction normalization must discard nested prior/deleted bodies as well as
current text from normalized state, previews and receipts. Custodians control raw-upload
and preview/cache custody and explicit disposal; any preview tool must document its
actual expiry/disposal behavior rather than imply automatic deletion. Old backups have
separate retention;
live erasure is not physical removal from every old backup.

## Authorized first apply boundary

Create a new private destination per selected public source channel, with an exact named audience chosen by the authenticated importer using the existing channel-creation rules. Recheck account activity and selected membership before the atomic commit and before disclosing a retry receipt. Import owner is the normal destination owner, not a newly empowered moderator. Imported records are separately externally attributed and immutable; ordinary local-author message mutation cannot reach them.

Unchanged source-key/content/binding receipts are idempotent; changed records/mappings conflict without overwriting. Known unsupported mutation/revision objects or blocking missing actors/files/roots reject the affected bounded import rather than silently omit, flatten or rewrite source. Import applies no source-deletion or redaction effects. Preserve supplied ordinary message text verbatim, including whitespace, exported edit metadata and exact timestamp strings. Source omissions remain unknown rather than evidence of a complete archive. Existing parser subset limits and untrusted-byte admission remain explicit.

Selected inputs and audience bind an exact private plan. One bounded atomic commit may create destinations, provenance records/files and durable receipts together; retry/restart recovers the same receipt, not additional channels. No inferred local authorship, account activation, accepted work, attention or ordinary unread activity. No provider requests or source URL fetches. Later editing or deletion, partial imports, automatic changed-source reconciliation and existing-channel merge remain separate work. None blocks this authorized immutable first apply.

The root native edition owns provenance/schema/archive integration. Source capture remains pure and independent. Emitted persistence and current-ACL verification are required alongside policy tests.

## First apply acceptance inventory

Duplicate names/deactivated/bot/unknown actors; forged local-ID associations;
private/DM/unknown visibility exclusion; stale/revoked destination audience; missing,
blocked, tampered and traversal/symlink files; root/thread missing/reordered messages;
malformed timestamps/duplicate keys; precise omissions/size limits; changed reruns;
lost-ack/restart/restore idempotency; existing tombstones never resurrect; historical
effects suppressed; current-ACL search/download/export; independently restored full
provenance/receipts/media. Synthetic fixtures first. Real exports require explicit
user authority and confidential handling; no provider account access is assumed.

## Public format reference and bounded preview candidate

Slack's official [export guide](https://slack.com/help/articles/201658943-Export-your-workspace-data) and [reading guide](https://slack.com/intl/en-gb/help/articles/220556107-How-to-read-Slack-data-exports), checked3 October2026, describe JSON channel folders plus users/channels reference files and file links. Supplied file links are not file bytes, and source retention can limit available history. This does not authorize access to any source workspace or establish export completeness.

The owner may add a source-only preview utility in scripts/import-preview.mjs,
and tests/import-preview.test.mjs. Supported candidate is
a manually extracted public-channel JSON subset with users.json, channels.json and
explicitly selected channel date files; plain messages and declared thread roots only.
No ZIP extraction, private-folder reading, source URLs, target database/API calls or
apply writes. Explicit supplied-byte maps may be checked against current media limits.
Its digest binds source content and caller-supplied mapping but is labelled source-only:
target ACL/authority/preconditions are unverified, applyReady=false. It is not an
approved apply plan or resumable importer. Real format coverage and unsupported
subtypes need per-record diagnostics, not an unsupported full Slack-compatibility claim.
Private preview output is absent-target mode0600 with explicit custodian disposal;
there is no automatic expiry, parser cache, uploaded copy or target provenance schema.

### Implemented source-preview boundary

Source-only preview remains a separate no-write capability. Native authenticated apply is described in IMPORT-APPLY.md.
The recognized channels.json registry provides positive public classification for
this declared subset. Any present is_private/is_im/is_mpim flag must be booleanfalse;
true, null, malformed or unknown flag values exclude the channel without reading
its folder. This classification is supplied-source metadata, not verified source
authority or a guarantee about material mislabelled in a malicious export. Reports
state knownPrivateFoldersRead=false and fullSourceHistory=unknown, not complete
private-data knowledge. No private-reference files/folders or URLs are traversed.

Bounds: twoMiB per metadata/config file, eightMiB metadata total,200 source actors,
50 source channels,1000 source messages,100 file references/supplied-file mappings,
1000 scanned directory entries,200 day files,5000 diagnostics, oneMiB per admitted
file and16MiB total supplied-byte reads. Aggregate budgets are checked before bounded
FD reads and fail the preview rather than being swallowed as a file omission. UTF-8
is decoded fatally; malformed JSON errors never echo source fragments. Namespace is
required and operator-asserted, never deduced from names. Duplicate keys are blocked.
Fixed string ordering and sorted audience sets are deterministic; source receipts
bind captured bytes and mapping/supplied-input digests bind configuration. A changed
source snapshot produces a changed digest, not a hidden reconciliation.

Deletion/change markers with missing, malformed or disagreeing target IDs block the
affected channel's candidates. Valid marker targets exclude originals/nested prior
bodies from preview candidates. Unknown file size remains unknown; malformed supplied
size values block before bytes are read. Reports contain opaque IDs/digests/diagnostics
without message text, source actor display labels or URLs. Source receipt paths can
be sensitive and remain custodian-only. Referenced local audience membership
remains unverified and grants no access. Source file hashes establish captured-byte
integrity only, not authenticity and completeness or ownership.

This offline utility requires a stable operator-controlled extracted directory.
Ordinary traversal/absolute/backslash/symlink paths are rejected; files are read through
NOFOLLOW bounded descriptors and checked for changes. The directory walk is not an
atomic openat capability sandbox against a concurrent hostile filesystem swap. Do not
use attacker-writable shared directories or mutate inputs during preview. A production
upload parser must stage an immutable private snapshot before claiming stronger race
confinement. The utility performs no ZIP extraction, cache creation or automatic expiry.
Preview owners explicitly remove their raw source/config/report files when no longer
needed. Its output refuses an existing path and is created mode0600.

Command: node scripts/import-preview.mjs SOURCE_DIR MAPPING_JSON SUPPLIED_BYTES_JSON
OUTPUT_JSON; use - for no supplied bytes. Mapping keys are sourceNamespace, actors
(source actor ID to optional local ID/null), and channels (source channel ID to
destination and exact audience). These are caller assertions and source-only
associations; targetAuthorityVerified=false and applyReady=false remain mandatory.
The preview tests are synthetic parser proof, not an importer or
restoration/adoption claim. Optional external-author mutation remains unimplemented and is not an import prerequisite. Changed-source conflicts reject without overwrite; actual target writes require the separately implemented authenticated bounded apply path.

Registry folder names must also be unique after conservative Unicode normalization
and case folding. Public/private/unknown channels sharing an alias are rejected
before any selected folder read, rather than trusting the public entry. This can
reject distinct case-sensitive directories conservatively; it does not expand
source visibility or target access.

## Native acceptance boundary

The native root edition owns API plan/apply, immutable historical projections and recovery. The earlier proposed redaction prerequisite was withdrawn; imported source remains immutable. `IMPORT-APPLY.md` describes the current wire and persistence contract. Full emitted Worker and browser verification remains required before integration. ZIP ingestion, normal app history/search UX and full-format/pilot acceptance are subsequent work.
