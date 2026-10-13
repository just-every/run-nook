# Faithful immutable local import

Implemented native D1 API and private source capture. Normal chat UI/search context and pilot acceptance remain separate work. No provider/API access, automatic redaction, identity-associated editing or browser launch is required. The bounded immutable import scope is retained from the owner-approved contract.

## Supported source and capture

Use the same stable operator-controlled extracted public JSON subset as IMPORT-CONTRACT.md: users.json, channels.json and selected channel date files. Supply the bytes of every referenced admitted file explicitly; source URLs are never fetched. Plain exported messages preserve exact text/whitespace, source actor objects, timestamp strings, thread references and original message metadata. Exported reactions/other ordinary metadata are retained as inert source provenance, not converted to live actions. Known unsupported message subtypes, missing roots/actors/bytes, malformed or duplicate records block capture instead of silently importing a partial copy. This is not full Slack coverage or verified source authenticity and completeness. No uploaded source file is altered.

`node scripts/import-capture.mjs SOURCE_DIRECTORY MAPPING_JSON SUPPLIED_BYTES_JSON ABSENT_CAPTURE_JSON`

Use `-` for no supplied bytes. Mapping is the existing preview shape: sourceNamespace, actors(sourceID→localID/null), channels(sourceID→{destination,audience}). Here destination is the proposed new private channel name; exact selected local audience must include the importing account. Capture output contains actual source bodies, actor metadata and admitted base64 file bytes, unlike body-free preview reports. It is created absent-target mode0600. Keep it private, stable and dispose of it explicitly; there is no automatic expiry or extra cache. Captured receipt digests must still match bounded rereads. Arbitrary paths, symlinks, malformed encoding/escaped invalid Unicode and input/byte bounds reject. The stable-directory concurrency limitation remains unchanged.

## Wire contract

All routes use the existing authenticated HttpOnly local cookie and origin/loopback admission. No source mapping creates a login, grants a role, proves identity, accepts a commitment or grants editing rights.

1. `POST /api/imports/preview` with `{capture}` validates capture and current active account/audience/associations, returns a private `planDigest`, counts and proposed new private destinations. It creates no tables, channels, memberships, messages or job state. Capture/body/file digests, owner and the immutable/new-private policy bind the plan. Collection order and audience sets normalize deterministically; raw source arrays and ordered file references preserve their original order.
2. `POST /api/imports/apply` with `{capture,intent,planDigest}` commits every selected new private destination, exact membership, historical actor/message/file provenance and durable receipt in one native D1 revision-CAS commit. Current account/audience authority is rechecked. It grants only normal channel-creation/owner membership powers. No existing channel expands and no source deletion or redaction is applied. A failure rolls everything back, without partially committing destinations or records. The same intent and unchanged plan returns the same receipt under current ACL; changed payload conflicts. Another intent cannot duplicate already imported source keys. Lost acknowledgement/restart is recovered by retrying that exact intent, not by inventing a new job.
3. `GET /api/conversations/:id/imported-history?after=<last-record-id>&limit=100` returns `{records,cursor,hasMore}` under current membership. External source actor, optional association, exact timestamp, raw source metadata and local parent/file IDs are separate fields. Records are immutable and never ordinary local posts. Source chronology compares exact decimal timestamps without floating-point identity loss. Invalid/foreign cursors reject.
4. `GET /api/import-files/:id/download` rechecks current ACL and forces download with nosniff/no-store, current byte/MIME/signature policy and safe disposition. There is no edit/delete route for imported source. Ordinary local message/outcome/file APIs cannot mutate it.

`GET /api/imports/search?q=TEXT` returns at most100 exact substring matches from current-member historical destinations, with immutable external provenance and parent IDs. Empty/oversized queries reject. It returns no raw source metadata and URLs and creates no state. Current membership is checked on every request; revoked users receive no matching results. Source timestamps sort by exact integer/fraction components without floating-point conversion. This is a dedicated API; the normal app Search screen is unchanged.

Selected source namespace and IDs are operator assertions. Digests demonstrate captured-byte consistency, not external identity, consent, export entitlement or authenticity. Original URLs/metadata can appear in protected provenance, but are never followed or rendered as executable content by this API.

## Persistence, recovery and limits

Native migration0004 adds immutable imports alongside local messages without changing applied migrations0001–0003. Imported destinations start frontier0: history creates no ordinary unread, attention, current approvals or inferred work. Later live posts retain their normal sequence/unread state; no mark-read shortcut crosses live work.

Native archivev4 preserves original source records and actors, exact bytes/bindings, private destinations and job receipts into an absent target and excludes sessions. Root archivev1–v4 and native archivev2–v3 recovery remain explicit supported mappings. Recovered users authenticate anew. Restore verifies capture/plan digests, source/thread/file scope and combined media quota, alongside event/read integrity. Rehashing inconsistent provenance cannot bypass admission. Digests do not authenticate a consistently replaced archive against an external source.

Source bounds remain200 actors,50 selected channels,1000 messages,100 referenced files and the existing metadata/descriptor budgets. Admitted files are at most1MiB, at most5 per message, with16MiB combined imported plus live/staged workspace bytes. API capture request ceiling33MiB includes base64/provenance overhead; a bounded atomic batch that cannot fit rejects rather than truncates. Native writes and offline recovery share a1,900,000-byte UTF-8 document ceiling below D1's2,000,000-byte physical row limit: base64 and provenance overhead cause507 before the raw media quota. No silent truncation occurs. Capacity remains unmeasured.

## Verification

`rer verify` includes emitted Worker native import tests (`tests/imports.mjs`), historical recovery (`tests/recovery.test.mjs`), pure source preview and capture controls, media quotas and current-session/ACL matrices. Complete verification remains an integration gate.

Native import is an authenticated API capability. ZIP wizard, larger resumable batches, undo and normal UI/search context remain future work. None substitutes for present immutable fidelity, current authority, durable receipts and independently recoverable bytes.
