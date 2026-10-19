# Nook import door adoption

Slack, Campfire and Mattermost share Base's upload, plan, fingerprint approval,
apply, status, reconciliation and strict Undo pipeline. The browser reads the
source archive locally and uploads only a reviewed normalized capture. The
server repeats source/effect and credential validation. Source authentication
is never uploaded by the screen. `/api/operator/import/*` admits the current
owner; `/api/rer/import/*` admits signed, scoped Business grants after opt-in.
Private file-only batches also consume a Business grant once, and cancelled
batches enter the ordinary durable cleanup queue. All request statements share
Nook’s measured admission budget, including native publication and file cleanup.
Both use the permanent installation key `nook-history-imports-v1` and the same
server-owned source allow-list. Each vendor/workspace has a separate namespace.

Migrations 0065–0067 add the missing kit schemas, the first door schema and native
publication/expiry bindings. Applied migrations are unchanged. Old source jobs
remain visible and use their original guarded Undo; no old upload, preview,
job creation or apply route remains. Source record overlap or a completed old
archive is reported as already imported. Native files, history and Base batches
travel in workspace archives; restore disables Business imports.

An unapplied dry run lasts 30 minutes. Current session, owner and reviewed member
versions fence apply. Imported history stays inert and hidden until publication;
newer source snapshots retain absent records and refuse native edit conflicts.
Strict Undo refuses later activity, membership changes and native dependencies.
Erasure withdraws opaque door bundles and previews, redacts kit/source custody,
and preserves unrelated native history. Body-free Base approval, lineage,
revocation and nonce replay facts remain as Base specifies.

## Base provenance and one compatibility adaptation

The source copies are from rer 0.2.68, Base commit
`6d38b54a6401879989e8d1f7ab4a02ffbdb4c46c`. All recorded copies are verbatim.
Two adapted files are excluded from the verbatim inventory and retain that Base
comparison origin through the local `import-kit` component:

- `src/base/modules/import-kit/src/door/jobs.ts` continues an **existing approved
  job** after an erasure withdrew its opaque preview. It never creates a job or
  a new approval on this path. It requires an existing kit job, the matching
  immutable reviewed fingerprint, a destination erasure journal, the original
  approval, current session/grant authority and the kit's redacted native plan.
- `src/base/modules/import-kit/src/door/authority.ts` lets only that continuation
  omit the withdrawn-preview predicate. Every approval, revocation, erasure
  epoch, native revision and kit custody predicate still applies.

Reason: Nook's existing partial-source erasure journey requires the erased
person's staged and applied data to disappear while the already-approved peer
records finish. Unadapted 0.2.68 returns 410 `snapshot_withdrawn` for that same
job. The retained erasure test covers both associated and external people,
interrupted R2 cleanup, native peer preservation, completion and guarded Undo.
Remove these adaptations when a published Base door supports this continuation.
New proposals, reconciliation of a withdrawn preview and unstarted plans retain
Base's refusal; an erasure never authorizes fresh source bytes.

Source: [Nook on GitHub](https://github.com/just-every/run-nook) and the
[Base 0.2.68 import door](https://github.com/runeditrun/base/tree/6d38b54a6401879989e8d1f7ab4a02ffbdb4c46c/modules/import-kit/src/door).
