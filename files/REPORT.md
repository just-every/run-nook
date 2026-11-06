# sd-nook-str-actions-1-fix1 — B-1 DM audit disclosure repair

Repository: just-every/run-nook
Branch: cloud/sd-nook-str-actions-1-fix1
Product head: 22dcc2d55bb017830e26f492964355ba3216c435
Original candidate retained as first parent: c9280b55339d5ec0b808c5a175feb34e48fa1e67
Fresh main retained as second parent: 4767f48a6fe0d5b00cc4a19a9b79d1d0a892e087
PR: none created; the repository guide specifies no PR landing requirement.
CI Verify: run 42223581001, exact head, pending at report preparation.
Product push: successful on first guard attempt. Evidence publication is separate and signals no product acceptance or landing.

## Scope and result

B-1 only. The shared audit SQL now joins a membership event's affected member only when its scope is a channel or the reader is a current DM participant. The session/manager authorization and DM roster check run in the same D1 query snapshot. Nonparticipants receive null subject and subjectName fields, so neither the API nor the shared CSV/JSON exporter can expose another participant. The existing renderer then shows the actor and the direct-conversation label. Audit events, count fields, source versions, timestamps and outcomes are preserved. Current participants retain their existing DM detail; private-channel add/remove attribution still names the actor and affected member.

Repair files: src/audit/server.ts; tests/audit-journey.mjs; tests/audit-browser.mjs; regenerated sources.lock.json.
Changes inherited from the required main merge: README.md, OPERATIONS.md, scripts/local/transfer.mjs, src/dev/admit.server.ts, src/server.dev.ts and tests/exit-export.test.mjs. These are main's own changes, preserved whole.
No edits to CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md or verify.yml. No U1–U4 implementation changes; preserved-actions.json verifies the original gated source/test bytes and unchanged audit renderer. C-1 erasure-subject follow-up remains outside this repair.

## Before and after through public doors

Both runs use the built production Worker, real local D1/R2 bindings, ordinary setup, invitations, native sign-in confirmation, conversation creation, message and audit HTTP routes. Only the outbound mail network edge is synthetic, following the repository's existing harness. There are no data writes through SQL and no special cases for names or IDs. The sessions belong to newly created synthetic test accounts, not a copied browser profile.

Sequence:
1. Confirm the Owner setup through POST /setup.
2. Invite and sign in Dev member, Dev admin and Unrelated admin through the existing team and auth doors.
3. Dev member creates a DM with Dev admin and posts a private marker.
4. Owner and Unrelated admin both receive 403 from GET /api/conversations/<dm>/messages.
5. Each reads the same DM's membership events through /api/team/audit, format=csv and format=json.
6. Owner opens Team → Audit log and downloads both formats from the native page. Capture native 1440×900 and 390×900 screenshots.

| Door / reader | Original c9280b5 | Published 22dcc2d |
| --- | --- | --- |
| Team audit page / unrelated Owner | “Dev member added Dev admin · a direct conversation” | “Dev member · a direct conversation” |
| Audit page API / unrelated Owner | recipient UUID and name in subject / subjectName | both null; actor and label retained |
| CSV / unrelated Owner | recipient UUID and name in subject columns | both empty; actor and label retained |
| JSON / unrelated Owner | recipient UUID and name in subject / subjectName | both null; actor and label retained |
| Audit API, CSV, JSON / unrelated admin | recipient disclosed in all three | recipient absent in all three |
| Audit API, CSV, JSON / participant admin | own DM detail present in all three | retained in all three |
| DM message read / unrelated Owner and admin | 403 | 403 |

Counts: nonparticipant API/export disclosures 6/6 → 0/6; Owner page disclosure at the two proof widths 2/2 → 0/2. Both membership events remain in every format (2 → 2), with count=1 for each event. The participant's three formats retain their detail (3/3 → 3/3).

Complete actual response bodies and parsed receipts are in before/ and after/. The after receipt names the full published SHA. Native UI downloads are also retained separately, not reconstructed from API data.
Screenshots:
- before/owner-team-audit-1440.png
- before/owner-team-audit-390.png
- after/owner-team-audit-1440.png
- after/owner-team-audit-390.png

The after screenshots were regenerated after the product push on the exact published head. Screenshots are native browser captures without image editing or compositing.

## Regression coverage and checks

Extended the existing audit journey, without a new test file or registration:
- unrelated Owner and admin DM access is denied;
- the audit page API and CSV/JSON omit both recipient UUID and name;
- all DM membership facts, actor attribution, labels and counts remain;
- participating Owner/admin can still see their own DM audit detail;
- private-channel add/remove attribution includes the actor and affected member through all three response formats;
- the existing browser journey asserts DM privacy at 1440;
- all original audit checks remain, including invitation/authority history, filtering, policy and override events, read-only access, erasure/anonymization and archive restore.

Final merged-tree build: exit 0.
Audit runtime, including browser: exit 0; 1 passed, 0 failed, 0 skipped (53.3 seconds).
Typecheck: exit 0.
Contract-docs check: exit 0; 0 errors, 0 warnings; documents current.
Source lock regenerated last, then check: exit 0.
Diff and staged diff checks: exit 0.
Exact published-head four-door browser/API/export probe: exit 0.

Full commands, actual exit codes and exceptional setup outcomes are recorded in commands.json; actual build/test/check output is under checks/. A shallow-ancestry lookup initially returned exit 1 and was resolved by deepening the owned clone. A repeated merge command returned 128 because the first merge was already pending; the fresh origin/main and MERGE_HEAD were then proven identical before the merge commit. Neither was a failed product check.

Counts before/after: 159 clauses; 1 done, 104 partial, 54 missing, unchanged. The touched audit-runtime registration remains 1 → 1. No clause status, Gap, Evidence or assertion was removed or weakened.

CLAIM NOOK-051 PARTIAL points=1,2 tests=tests/audit-runtime.mjs#NOOK-051 membership revocation, export, erasure and an interrupted step appear in an admin-only filterable log, an erased actor is anonymized with the facts kept, and the log survives archive restore
DEFAULT NOOK-051: disclose actor, direct-conversation label and counts to unrelated managers; project DM subjects only for current participants.
GAP NOOK-051: C-1 erasure subject remains in FOLLOW-UPS; no change in this B-1 repair. Point 3 digest-schedule behavior was not rerun locally in this scoped repair.

## Plan and publication custody

The full plan is PLAN.md. It was completed by preserving the original candidate, reproducing before edits, repairing the shared projection, extending existing coverage, merging fresh main, restoring generated views, regenerating the lock last, checking every candidate identity/trailer and publishing only the named cloud branch.

All five commits in origin/main..HEAD, including side parents, passed the explicit author/committer/trailer inspection. Published original commits were preserved. The new merge/repair commit uses Run Edit Run fleet <fleet@runeditrun.com>, with no co-author trailer. The clone-local cleanup hook remained active and preserved repository hooks.

The Mac fleet owns the complete publication scan and landing. This cloud task does not claim to have run that Mac scan, and never pushes main or a default branch. The exact-SHA Verify is observed through REST using one watcher and at least 300 seconds between observations. No workflow is edited, dispatched or rerun to obtain a different result.

Actual product provenance is product-provenance.json; the push receipt is product-push.log; the per-door receipts are before/receipt.json and after/receipt.json. Evidence is transported only on refs/heads/evidence/sd-nook-str-actions-1-fix1 through the supplied report-only entrypoint. No packet file is part of the product branch. Cleanup and final CI disposition are recorded in terminal-receipt.json.
