# Take a readable copy of your conversations

Use **Readable export** in You to prepare all conversations you can currently
read, or the conversation control to prepare one conversation. This includes
your own DMs. Ordinary member exports never open another person’s DM or a
private channel you have not joined, including when you have an admin role.

For a whole-workspace exit, a current owner opens **Owner workspace export
policy** and explicitly enables **Allow owners to export the whole workspace,
including private conversations**. This policy is disabled initially. Choose
**Whole workspace** in **Export scope**, accept custody and prepare the copy.
Saving a policy change durably announces its version to every current member in
Readable export and records the owner, time, version and recipient count in the
owner’s policy history, in the same commit as the setting. Every workspace report
and downloaded manifest states the policy version it uses. This separate owner authority includes every published conversation, its actual
participants and files, plus non-secret default-channel, broadcast and readable
export configuration. It does not add the owner as a conversation member or
allow ordinary private reads. Unpublished import conversations are individually
named as omissions. Protected held copies and compliance-search authority remain
outside this door (NOOK-039); no hold inventory is disclosed.

Every workspace request checks the current owner role and the enabled policy
version. Disabling or changing the policy blocks all older workspace jobs,
including their files and already prepared pages. Re-enabling requires a fresh
job. Operational restore discards jobs and resets this authority to disabled;
an owner must explicitly grant it again in the restored installation.

Accept custody of the downloaded copies, then choose **Prepare**. Preparation
checks bounded pages and the real SHA-256 of each attached file. Its completeness
report shows verified pages, records, files, file bytes, per-record-type counts
and source omissions. **Cancel preparation** retains the verified cursor. Open
the job and choose **Resume** or **Continue**, including after closing the page
or restarting Nook. Nook does no background preparation after the page closes.

Once preparation is complete, download **offline HTML**, **JSON** or **JSONL**.
Every format contains the same records and exact file bytes, including both
native and imported messages, complete recorded threads, message revisions and
tombstones, reactions, decisions, commitment acceptance/version history,
membership history, source mappings and conversation configuration. A complete
report can still name source omissions; it is not a claim that missing source
history was recovered.

The HTML is one file: open it without a server or network connection. Use its
conversation index, thread/source links, expandable version history and file
download links. All message and source text is displayed as text. It loads no
external images, fonts, scripts or tracking links. Attached bytes are embedded;
the file index names their sizes and SHA-256 checksums. The complete machine
format is embedded as inert JSON in `script#nook-export` for another importer.

Preparing and downloading check your current session and current scope authority
on every page, report and file request: membership for ordinary exports, current
owner role and policy version for workspace exports. If membership is removed, those requests
stop. A change to selected source content invalidates the job, including a change
after completion. Start a new job to get one consistent source revision. Writes
in unrelated conversations do not invalidate a selected conversation export.
Shared identity changes or import publication can invalidate jobs that depend
on those shared identities. A canceled, unchanged job resumes at its saved
cursor; an invalidated job cannot be resumed into mixed revisions.

If attached bytes are missing or corrupt, preparation stops with the file ID and
an incomplete report. Correct the source storage and continue; Nook does not
replace bytes, fetch an external URL or mark the job complete on a guess. An
interrupted request may have committed its page: continuing reads the durable
cursor and never appends the same page twice.

Downloads are assembled and verified in the browser. Large copies need enough
browser memory for their records and embedded file bytes. Stop a download to
release its in-flight work; its completed server job remains available. Use a
conversation scope when preparing a smaller copy is useful. There is no record
cap or silent truncation: preparation pages every set to its end and reconciles
each set’s observed count against its source count.

## What the report explicitly omits

- Installation credentials, sessions, sign-in links, provider tokens, push
  endpoints and encryption keys. These are not portable conversation history.
- Protected held copies. Ordinary membership export has no hold-search or
  compliance authority and does not reveal the hold inventory.
- Drafts, reads, private saved items, reminders, scheduled templates,
  notification preferences and other personal state; staged/reserved uploads
  and unattached or expired files; directory emails, private profile values,
  status and presence.
- Raw source archives, integration secrets and installation authentication,
  domain, mail and provider configuration. Conversation topics, archive/manager
  state, posting policies, pins and recorded channel actions are included. Whole
  workspace exports also include non-secret workspace defaults, broadcast policy
  and export policy; credential-bearing local configuration stays excluded.
- Workflow/app definitions and agent run history: this release does not
  implement these artifacts. Their absence is named rather than represented by
  invented records. Future implementations must add a documented dataset and
  source-revision coverage before claiming that their exit is supported.
- Missing external artifacts and source files: each unavailable received file
  reference is listed on its imported message with its source ID, available
  name and reason. Source URLs remain inert references and are never fetched.
- Erased bodies, revisions and file bytes. Tombstones preserve structural
  thread positions. An explicitly retained current body remains marked as
  retained under erasure policy; older erased versions are not recreated.
- Unknown earlier history. Memberships present when this feature was adopted
  have a `baseline` at adoption, not an invented join date. Subsequent joins and
  leaves are exact recorded changes. Earlier native membership events retain
  their sequence and subjects, but did not record direction/time. Imported
  membership information is limited to its received source channel record.
  Imported revisions and reactions preserve only what Nook actually received.
  Removed native reactions retain event positions without an emoji payload.

Downloaded copies are in your custody. Live erasure and removal stop future
server reads and invalidate the job; they cannot recall copies already
downloaded or reconstruct someone else’s deleted offline copy. Store copies
privately, share them only with authorized people, and apply the organization’s
retention rules. Server jobs store only opaque scope IDs, revision/cursor data,
counts and checksums; they store no message body or copied file bytes.

## Machine format, version 1

The format identifier is `nook.readable-export`, with integer `version: 1`.
Importers must reject unsupported versions instead of guessing field meanings.
UTF-8 JSON is the interchange encoding; preserve IDs, source timestamps and
source records as supplied. This is an openly documented interchange format,
not an operational backup or a live credential transfer.

The JSON object contains:

| Field | Meaning |
| --- | --- |
| `format`, `version` | Format identity and schema version. |
| `report` | Job identity/time/scope, completeness, per-type record counts, file count/bytes, named omissions, custody and the ordered page checksum index. |
| `records` | All scoped records, each `{type, conversation, data}`. |
| `files` | Exact bytes as `{id, sha256, size, base64}`; canonical base64 is decoded before checking byte size and SHA-256. |

JSONL has one complete JSON object per line and ends with a newline. Its first
line is `{type:"manifest", format, version, report}`. Each subsequent conversation
record has the same `{type, conversation, data}` shape as JSON. Final
`{type:"file_bytes", data:{id,sha256,size,base64}}` lines carry the exact files.
The manifest’s `records` count excludes the manifest and file-byte lines; its
file count and byte total count each attached file occurrence, even if two
attachments contain identical bytes. Consumers can deduplicate storage by SHA.

| Record type | Key data and relationships |
| --- | --- |
| `workspace_configuration` | Workspace scope only: non-secret `export_policy`, `default_channels`, `broadcast_policy`, `broadcast_people`. Its conversation is the empty string. |
| `unpublished_imports` | Workspace scope only: source job/channel ID, state and exact named omission; unpublished content is excluded. Its conversation is the empty string. |
| `conversations` | `id`, `name`, `kind`, `owner`, native sequence/version; recorded topic/archive/manager settings. |
| `members`, `dm_roster` | `user`, available display `name` and erasure marker. The DM roster is historical; current members are a separate set. |
| `membership_history` | Durable `seq`, `user`, `action` (`baseline`, `join`, `leave`) and recorded ISO `at`. |
| `messages` | Native `id`, `author`/`authorName`, `body`, `parent`, `version`, `deleted`, `erased`, `retained_body`, ISO `created`, native `sequence`. |
| `message_versions` | `message`, numeric `version`, `body`, ISO `at`; all retained native versions including the original/current version. |
| `reactions` | `message`, `user`/`actorName`, `emoji`, ISO `created`; each row is one live native reaction. |
| `outcomes` | `id`, `kind`, `body`, author/assignee labels, `source` and `source_version`, current `version`, `status`, `deadline`, erasure flags. |
| `outcome_versions` | `outcome`, numeric `version`, actor identity/label where retained, `body`, `status`, `deadline`; accepted/proposed transitions are independent of read state. Missing timestamps were never recorded. |
| `events` | Content-free native `seq`, `kind`, `object`, `actor`; membership events carry `direction:"unknown"` and `at:null` when those facts were not recorded; reaction events with missing payload remain incomplete historical facts. |
| `imported_messages` | `id`, `job`, source `key`, `source_actor`, exact `source_timestamp`, `namespace`, `body`, `parent`, source sequence, erasure/retention flags, label, received `sourceRecord`, source `reactions`, per-message `omissions`. |
| `source_conversations` | `job`, `source_id`, `namespace`, received `sourceRecord`, destination `conversation`. |
| `source_actors` | Referenced `job`/`source_id`, native `association` if retained, display name and bot/app flags. Private directory profile fields are excluded. |
| `source_files` | Source `id`, `job`, `message`, `source_id`, destination `attachment`, `position`. |
| `files` | Attachment `id`, author/message, name/MIME, `size`, `sha256`, state/time/position and erasure marker; attached files have `link:"sha256:<digest>"`. Deleted files instead have a named `omission` and no bytes/link. |
| `pins` | Pin `id`, `message`, actor and recorded time. |
| `posting_policy`, `posting_people` | Recorded conversation posting/reply policy and selected participant IDs. |
| `channel_history` | Action `id`, version/sequence, action/actor/subject/time and any recorded posting-policy change. |

Each record repeats `conversation` inside `data` for easy table import. IDs are
opaque, installation-local strings; native and imported messages share the
message-ID relationship space. A `parent` points to a root message, including
roots deleted into tombstones. Source import sequences do not advance native
unread or work acceptance. Sort native ISO `created` and exact source timestamps
for a combined reading timeline; sort revisions by numeric version. Export
pagination order is an opaque JSON-tuple key order and makes no chronology claim.

For an importer elsewhere: validate the manifest/version, enumerate and reconcile
all record and file totals, decode and hash each file, create conversations and
identity mappings, then import messages/parent links, revisions, outcomes and
their action history without treating imported status as new acceptance. Keep
source mappings and omissions. Preserve tombstones instead of creating an
author or body for erased content. A `sha256:` link resolves to decoded file
bytes matching that digest, not a remote URL. HTML importers can parse the inert
`script#nook-export` JSON and perform exactly the same checks.

## API and resumable readers

All endpoints use Nook’s ordinary current authenticated session, same-origin
mutation rules and current conversation grants. They are not bearer download
links. Keep authentication outside the exported documents.

| Request | Result |
| --- | --- |
| `POST /api/readable-exports` with `{scope:"permitted",custodyAccepted:true}` | Create a fixed set of currently readable conversation IDs; no later-added scope is silently included. |
| `GET /api/readable-exports/policy` | Current workspace export policy and whether the caller can manage it. |
| `POST /api/readable-exports/policy` with `{enabled,version}` | Current owner changes policy under its exact current version; every earlier workspace job loses authority. |
| `POST /api/readable-exports` with `{scope:"workspace",custodyAccepted:true}` | Current owner with enabled policy creates a whole-workspace job. |
| Same request with `{scope:"conversation",conversationId,custodyAccepted:true}` | Create one currently readable conversation job. |
| `GET /api/readable-exports?after=<cursor>` | Own job metadata, 20 at a time; follow `hasMore`/`cursor`. Revoked/stale jobs show unavailable/invalidated without conversation labels. |
| `GET /api/readable-exports/:id` | Current report; denied when scope or source changed. |
| `POST /api/readable-exports/:id/step` with `{}` | Verify/commit the next bounded source page; repeat until report `complete` is true. |
| `POST /api/readable-exports/:id/cancel` or `/resume` with `{}` | Cancel/resume durable progress. Resume rechecks all source and authority fences. |
| `GET /api/readable-exports/:id/index?after=-1` | Ordered page checksum index, 100 entries at a time; follow `hasMore`/`cursor`. |
| `GET /api/readable-exports/:id/pages/:ordinal` | UTF-8 JSON `{format,version,job,ordinal,records}`. Hash the exact response bytes and compare with the index and `X-Content-SHA256`. |
| `GET /api/readable-exports/:id/files/:attachmentId` | Actual verified attachment bytes with `X-Content-SHA256`; current membership and source revision are rechecked after reading/hashing the object. |

`401` means the session is unavailable, `403` means selected conversation access
was revoked, `404` covers another person’s/unknown job or file, `409` means
canceled/concurrent/stale source progress, and `503` means real file integrity
or normalized storage is unavailable. Continue from the latest durable report
after an interrupted step; concurrent step requests cannot both append a page.
Page and file responses are never cached. A complete download verifies each page
hash, ordered page identity, record count, each actual file hash and total bytes,
then rechecks the current complete report before saving.
