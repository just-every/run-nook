# Nook acceptance

`rer verify` is the complete local command for the implemented evidence described below. It does not establish unimplemented target journeys. Push CI runs contracts,
unit tests, runtime journeys at both widths, and notifications in four parallel
jobs with 15-minute limits. The guided installer, full README and realistic pilot fresh-clone
journeys at 1440 and 390 retain every assertion and run nightly, on release tags,
and manually. It covers real Workers and local D1: runtime suites use the emitted build,
while the README and pilot journeys use the ordinary rer development workflow:

- current sessions and conversation ACLs on every API, document and generated
  server function, including expired, revoked and missing sessions;
- exact retry identity, compare-and-swap edits, tombstones and complete replay;
- fixed DMs, owner-controlled channel membership and full-history disclosure;
- decisions with version history and commitments accepted only by the assignee;
- private file staging, binding, download and erasure;
- calm attention (follow, mute, quiet time, snooze, done) independent of unread
  and of accepted work;
- `tests/notify-journey.mjs` (C14 email): the emitted Worker with local D1,
  native email-link sign-in and a fake provider at the test harness's network edge,
  through public
  doors: email off until a member turns it on (with the keyboard, at 1440 and
  390), one email for a mention while away and for a commitment proposal,
  nothing for a routine follow or during quiet time, urgent requests held or
  let through by the recipient's choice, two mentions folded into one email
  with a count, cancellation after removal from the conversation, deletion of
  the message or deactivation, a refused send retried on schedule and shown as
  "email not delivered" to the sender and the owner before it succeeds once,
  a queued retry surviving a Worker restart, the no-session "turn these off"
  link, and no message text or file name in any email;
- immutable imported history; the supported Base portability v1 recovery is the
  explicit backup-only `rer import --legacy-v1 --input FILE --yes
  --acknowledge-unverified-metadata --output FILE` path. It checks the v1
  checksums, records that the archive's metadata is unverified, restores into an
  empty installation, and writes a fresh v2 archive. The legacy single-workspace
  document conversion and root SQLite/native archive procedures are separate
  offline recovery paths in `OPERATIONS.md`; this is not recovery from every
  earlier format;
- the rer command contract: setup, first-run `/setup`, key-gated local dev sign-in, preview,
  doctor, reset, export/import round trip, the guided installer, owner-account
  deploy against a fake Cloudflare account, and a fresh-clone README journey;
- normalized storage: an install from migrations 0001–0003 moving forward, 25 MiB R2 attachments and
  Durable Object fanout with replay from D1;
- two people in two sessions at 1440 and 390: own sends never unread, viewing
  clears unread, Attention Accept and Discuss, threads and URL state;
- day-one team surfaces at 1440 and 390: hosted invitation semantics at the fake
  provider edge, local teammate entry, guest scope, deactivation, channel browse and join, reactions, inline image preview,
  tab-title count and retirement of duplicate open-tab OS notifications;
- Slack export import on synthetic fixtures: review, resumable apply,
  imported history and search, guarded undo, and the wizard at 1440 and 390;
- `tests/pilot-journey.mjs`: a fresh local rer install/setup, two independent
  dev-authenticated browser sessions at 1440 and 390, local teammate entry, private
  conversation/file, reviewed realistic Slack history with supplied files and
  an explicit missing-file choice, a complete root/thread/file census, source
  reactions/mentions/edited markers, selected audiences and revocation, unchanged
  unread/attention/mail counts, populated safe/refused undo, and rer export/reset/
  import with identical reexport content;
- desktop (1440) and mobile (390) browser and keyboard journeys and the homepage.

The pilot uses a realistic synthetic fixture shaped from Slack’s documentation: 5,000 source messages over 15 months, 40 source directory entries and six channels (one empty), with threads, bot/app records, files, edits, reactions and administrative records. No real Slack export or Slack account was used. The fixture supports bounded local verification, with no Slack parity claim.

Private inline image evidence is split between `tests/team-image.test.mjs`, which accepts genuine PNG bytes and rejects active content, truncation and corruption, and `tests/team-browser.mjs`, which loads a private image preview through the actual Worker at both widths. `ImagePreview.tsx` fetches the ACL-checked PNG/JPEG endpoint and renders a revocable blob URL; downloads remain forced attachments. These checks do not establish virus scanning.

The separate docs site suite checks manifest coverage and rejects broken pages,
anchors and raw HTML. `docs/site.json` currently publishes 11 public guide
routes. An earlier local browser pass exercised the sidebar, table of contents
and pager at 1440/900/390; its axe check covered the docs home and the long
mobile guide with its menu open.

`node tests/part6.mjs --platform-root PATH` needs a checkout of the platform
repository, so it runs outside verify. It proves the schema-2 artifact, the
signed owner claim, owner/anonymous Lobby equality at 1440 and 390, editor
authority and compiled-source persistence against the emitted Worker. The old
installed-homepage editor, draft and visible-publication checks were retired
when installed `/` became the session-independent Lobby.

The core runtime browser journey uses the repository-pinned axe-core package to
check the conversation with channel/thread routing closed and open, plus the
native message and member erasure dialogs, at 1440 and 390. It fails on serious or
critical axe findings. This bounded check does not cover imported-author
erasure and is not a full accessibility audit or WCAG claim. Hosted operation
on a real Cloudflare account, live mail-provider delivery, capacity beyond local
measurement, integrations and real-team adoption remain unproven. Email has a
local journey with a fake provider at the network edge; C15 Web Push has the bounded local checks
below. Neither establishes delivery to a real inbox, browser or device. The
installable PWA is shipped, but offline operation is not supported: its service
worker caches no requests or private content. There is no native iOS/Android
push transport or paging guarantee. Local synthetic verification is not a
production, parity or adoption claim.


## C15 Web Push evidence boundary

`pnpm test:push` runs the emitted Worker, real local D1 and the real ChatHub alarm. One core public-route flow signs in, registers an owned subscription, opts in, sends a message, and independently verifies VAPID and decrypts the actual outbound RFC 8291 packet at the sole fake network edge. A new conversation then proves read-before-delivery cancellation without relying on folding. Focused public security coverage rejects missing sessions, cross-origin mutations, another account's subscription ownership, non-vendor endpoints, invalid keys and unsupported transports, and checks that responses expose no endpoint/auth/private key.

These are local synthetic checks, not browser-vendor or OS receipt evidence.
Nook ships an installable PWA manifest and service worker, but this does not
prove installation or Web Push delivery on a particular browser or device.
Safari on iPhone/iPad and macOS, Chromium browser and installed-app delivery,
subscription disappearance, real lock-screen appearance, mobile keyboard/a11y
and installed PWA layout remain evidence to collect on real devices. The service
worker caches no requests or private content, so offline operation is not
provided. No native iOS/Android transport exists. WebKit forbids silent Web
Push, so immediate sleeping-device clear/badge-only behavior is explicitly
blocked; foreground read synchronization and badges accompanying visible
alerts are the supported web behavior.

## Target clause acceptance journeys

The 16 October 2026 contract is the full target for an owned US team-chat product replacing Slack, Microsoft Teams and Google Chat. Each numbered journey below is through a user-facing app, HTTP/API, supported client, authorized provider or documented rer command. Build rounds must implement missing journeys and supply measured acceptance; a planned journey is never a passing test. Provider/network fakes belong only at that edge in automated tests; native-device, real migration, real media and hosted claims require the real environments named. App journeys must be used and inspected at 1440 and 390 with realistic data and the named denied-access/error end states; native/assistive-technology cases also run on their supported devices. Keep every permanent clause ID, including C1–C15 aliases, DOCS-001 and ERASURE-001.

The statuses and citations below match CONTRACT.md at main `ece3278576aa813e4d8eb6a17502df7d77bc829d`. Existing local evidence above remains bounded as stated. The new SSO, hold and compliance clauses define separate authorities; they do not silently grant an ordinary owner/admin DM access or change today’s erasure behavior. Only implementation with its acceptance can change those product paths.

- **NOOK-001 — Current identity and conversation membership (C1).** **Status: done.** Through signed-in HTTP, SSR, search, replay and generated loaders, revoke or expire a session and remove a participant; every subsequent private read/write is refused, including a workspace admin attempting another person’s DM.

  Current evidence: `src/platform/request.server.ts`; `src/platform/storage/context.ts`; `tests/operator-security.mjs`; `tests/storage-guards.mjs`.

- **NOOK-002 — Atomic messages, retries and replay (C2).** **Status: done.** Send through the conversation API, repeat the same intent after a lost acknowledgement, then change its payload; observe one ordered message, the original retry result and a conflict for changed intent. Race edits and delete; replay shows current tombstones without deleted bodies.

  Current evidence: `src/platform/storage/messages.ts`; `src/platform/storage/commands.ts`; `tests/storage-flows.mjs`.

- **NOOK-003 — Fixed DMs and channel membership (C3).** **Status: done.** Create channel/private/DM conversations through the app, add a channel member after earlier messages, and observe full-history disclosure and access. Remove that member and deny history/search/replay/files immediately; refuse DM participant changes and unrelated-admin DM access.

  Current evidence: `src/platform/storage/commands.ts`; `src/team/channels.server.ts`; `tests/team-runtime.mjs`; `tests/storage-flows.mjs`; `tests/browser.mjs`.

- **NOOK-004 — Decisions and commitments (C4).** **Status: done.** From a discussion, record a decision and propose a commitment. Another participant cannot revise the decision or accept for the assignee; the assignee accepts the exact version and reports completion. Reopen history and see human authorship, source context and reported status.

  Current evidence: `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs`.

- **NOOK-005 — Read cursors and attention (C5).** **Status: done.** Read a thread from two sessions, reconnect one, and observe monotonic unread recovery with own sends excluded. Refuse read markers beyond the durable frontier; closing Attention does not accept work or mark unseen messages read.

  Current evidence: `src/platform/storage/read.ts`; `src/chat/useReadVisibility.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs`.

- **NOOK-006 — Offline restore (C6).** **Status: done.** Use rer export/reset/import into an empty stopped installation, complete explicit identity recovery, and compare conversations, memberships, outcome versions, attention and downloaded file bytes. A populated destination, altered checksum or invalid graph is refused; no old delivery or session revives.

  Current evidence: `src/platform/storage/portability.mjs`; `scripts/local/transfer.mjs`; `scripts/storage/recover-identities.mjs`; `tests/recovery.test.mjs`; `tests/pilot-journey.mjs`.

- **NOOK-007 — Safe rendering and local binding (C7).** **Status: done.** Post active markup and malformed/oversized bodies through public APIs; markup stays inert and invalid input fails without writes. Cross-origin mutations, foreign sessions and unsafe local origins fail; production output excludes dev admission.

  Current evidence: `src/platform/operator-auth-runtime.mjs`; `src/platform/request.server.ts`; `src/chat/MessageRow.tsx`; `tests/team-security.test.mjs`; `tests/operator-security.mjs`.

- **NOOK-008 — Evidence limits (C8).** **Status: partial.** For a release candidate, reproduce the documented local public-door journeys, then separately record hosted multi-device, provider, migration and capacity results before those target clauses become done. Failed or unmeasured end states remain visible.

  Current evidence: `ACCEPTANCE.md`; `tests/push-journey.mjs`; `tests/pilot-journey.mjs`. Local synthetic journeys exist; hosted, real-device and full-category acceptance remain unproven.

- **NOOK-009 — Backup and export (C9).** **Status: done.** Use stopped rer export/import and authenticated rer export --target remote. Reject non-owner/expired remote sessions and any remote restore; inspect that archives retain private records, media and erasure journal while excluding live credentials, devices and pending deliveries.

  Current evidence: `src/platform/portability.server.ts`; `src/platform/storage/portability.mjs`; `tests/exit-export.test.mjs`; `tests/team-portability.test.mjs`.

- **NOOK-010 — Commitment revision and cancellation (C10).** **Status: done.** Accept a proposal and revise its text/deadline: renewed acceptance is required at the new version. Cancel and create a new proposal to change the fixed assignee. Refuse stale acceptance, cross-conversation moves and author impersonation of completion; cancellation stays terminal in history and deleted source refs reveal no body.

  Current evidence: `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs`; `tests/erasure.test.mjs`.

- **NOOK-011 — Cached retries, synchronization and complete history (C11).** **Status: done.** Page beyond the tested history window and reconnect after missed edit/delete events. Repeat a previously successful intent after membership revocation; it must be denied before cached response lookup, with no missing or duplicated durable history.

  Current evidence: `src/platform/storage/history.ts`; `src/platform/storage/commands.ts`; `src/platform/storage/live.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs`.

- **NOOK-012 — Private attachments (C12).** **Status: done.** Upload and bind ordered private files through the app, preview genuine PNG/JPEG and download exact bytes as an authorized participant. Deny outsiders and removed members, reject active/corrupt/oversized input, recover lost-put acknowledgements and verify deletion and backup round-trip.

  Current evidence: `src/platform/storage/files.ts`; `src/team/preview.server.ts`; `src/team/ImagePreview.tsx`; `tests/team-image.test.mjs`; `tests/storage-flows.mjs`; `tests/team-browser.mjs`.

- **NOOK-013 — Calm attention (C13).** **Status: done.** At 1440 and 390, follow a thread, mute its channel, send explicit mentions/urgent requests, snooze and complete triage, and enter quiet time. Restart and sign in elsewhere: preferences persist, due items return under current ACL, and neither triage nor reads accepts responsibility.

  Current evidence: `src/family/team-chat/attention.ts`; `src/platform/storage/commands.ts`; `tests/attention.mjs`; `tests/storage-flows.mjs`; `tests/browser.mjs`.

- **NOOK-014 — Email notifications (C14).** **Status: done.** Run the emitted-Worker notification journey through sign-in and settings with only the provider network edge substituted: opt in, mention/propose, fold bursts, hold quiet items, cancel read/deleted/revoked items, restart a retry, expose refusal/uncertainty and use the scanner-safe unsubscribe POST. Inspect that mail contains no private body or file name.

  Current evidence: `src/notify/run.ts`; `src/notify/queue.ts`; `src/notify/compose.ts`; `tests/notify-journey.mjs`; `tests/notify.test.mjs`. Done for the specified local/provider-acknowledgement behavior; real inbox receipt is not established.

- **DOCS-001 — Public documentation from Markdown.** **Status: done.** Build and open /docs; every declared page renders, links and anchors resolve, raw HTML remains inert, and every root/docs Markdown source is published or has a recorded exclusion reason. The app Lobby and private workspace keep their existing routes.

  Current evidence: `src/docs/build/site.ts`; `src/docs/build/render.ts`; `docs/site.json`; `tests/docs-site.test.mjs`.

- **ERASURE-001 — Member, message and imported-author erasure.** **Status: partial.** Through Team and message erasure doors, preview counts, confirm and resume a pending job. Try an unrelated DM, an insufficient role, self and last owner; deny each. Remove native/imported content and verified R2 bytes, preserve only declared structural tombstones, anonymise audit, and refuse an older archive when the latest erasure journal is supplied.

  Current evidence: `src/team/erasure/service.ts`; `src/team/erasure/graph.ts`; `src/team/erasure/blobs.ts`; `tests/erasure.test.mjs`; `tests/erasure-browser.mjs`; `src/team/erasure/identity.ts`; `src/base/modules/operator-auth/accounts/owner-signin.mjs`; `migrations/0025_owner_signin.sql`. Native/imported cascade, blob verification and journal checks exist; retained owner-sign-in grants can obstruct eligible owner erasure, and Base auth-audit attribution is not covered by the product anonymization path. Full erasure must include these records.

- **NOOK-015 — Web Push (C15).** **Status: partial.** Run pnpm test:push through subscription, preferences, emitted Worker and real alarm; independently decrypt the RFC 8291 packet and verify VAPID, revocation, quiet/read cancellation, per-device folding and visible failure. Separately demonstrate foreground/background/locked-device visible notification, tap authentication and badge reconciliation on supported Safari, Chromium and Firefox devices.

  Current evidence: `src/push/run.ts`; `src/push/subscription.ts`; `src/push/crypto.ts`; `tests/push/journey.mjs`; `tests/push/packet.mjs`; `tests/push-service-worker.test.mjs`. Bounded local Web Push and PWA ship; browser-vendor/OS receipt and real-device installation evidence are missing. Native transport belongs to NOOK-021.

- **NOOK-016 — Everyday conversations.** **Status: done.** Use two signed-in people at 1440 and 390 to create/join a channel, exchange roots/replies/reactions, open a thread link after reload and edit/delete a message. An outsider and a guest fail to discover private content or expand access.

  Current evidence: `src/team/channels.server.ts`; `src/team/reactions.server.ts`; `src/chat/location.ts`; `tests/team-runtime.mjs`; `tests/team-browser.mjs`; `tests/browser.mjs`.

- **NOOK-017 — Composition and personal workspace.** **Status: partial.** Compose formatted text/code and an attachment, leave and resume a draft on each supported client, deliberately interrupt a send and reconcile it once. Switch accounts/workspaces and inspect draft isolation; mark unread and change status/time zone without changing work acceptance. Define title, phone and manager fields, fill them and find a person by department in the people directory at 1440 and 390; a guest sees only people in their granted channels and no hidden field.

  Current evidence: `src/chat/Composer.tsx`; `src/chat/Navigation.tsx`; `src/platform/storage/messages.ts`; `tests/browser.mjs`. Plain-text composition, mentions and attachment sends exist; rich text, durable drafts, workspace switching, profile/presence, custom profile fields, the people directory and organization remain target work.

- **NOOK-018 — Invitations, roles, guests and offboarding.** **Status: done.** Invite a member and scoped guest via Team, confirm once, browse/join as each and refuse guest expansion or owner DM snooping. Deactivate a person signed in twice, reactivate, and prove both old sessions remain invalid and explicit regrant is required.

  Current evidence: `src/team/invitations.server.ts`; `src/team/access.ts`; `src/platform/operator-auth-runtime.mjs`; `tests/team-runtime.mjs`; `tests/operator-security.mjs`.

- **NOOK-019 — Search conversations and files.** **Status: partial.** Find an old imported reply and a phrase inside a permitted PDF/text attachment using author/date/channel filters; open context from each client. Search "Q3" and "HR" with a channel and date filter and get every authorized message and file containing those tokens. Page an 80,000-message corpus completely with no duplicate or missing result; remove membership/delete a file and confirm its snippets, counts and cached results disappear.

  Current evidence: `src/imports/history.ts`; `src/chat/SearchView.tsx`; `tests/slack-import-history.test.mjs`; `tests/pilot-journey.mjs`. ACL-scoped native/imported message substring search exists; file search, operators, structured filters and token search for one- and two-character terms are missing.

- **NOOK-020 — Saved items and channel pins.** **Status: missing.** Save a DM and pin a channel message, retrieve both after restart on another device, then remove membership and erase the source. Private saves stay private and every unavailable item loses its excerpt.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-021 — Native clients and dependable device catch-up.** **Status: missing.** Install production-signed apps on real iOS/Android and each desktop OS. In foreground, background, force-closed and locked states send a mention/DM/call invite, observe alert/badge and tap to context; disable permission and expose the reason. Read on another device, disconnect/reconnect, race a send retry and revoke membership: converge once, purge revoked caches and verify logout isolation. Share a photo and a PDF from the iOS and Android share sheets into a private channel thread and see each post once. **Delivery bar:** on a real-device fleet of at least two iOS and two Android phones at the published OS floor plus each desktop OS, send 500 mixed eligible events (mentions, DMs, keyword hits, broadcast mentions and call invites) spread across foreground, background, force-closed and locked states over 24 hours. Record each event's server commit time and device display time from device logs, then compare to the bar: ≥ 99.5% displayed, p95 ≤ 5 s and p99 ≤ 30 s commit-to-display, locked-phone call ring ≤ 5 s at p95, and every badge equal to the authoritative unread plus Attention count within 10 s of reconnect. Every undelivered event appears as `provider-unconfirmed` or `device-unobserved` in the device delivery view and owner report; a single silent miss fails the journey. Install on a device below the floor and see the unsupported notice. A web-Push test alone cannot satisfy this journey.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-022 — In-context voice, video and screen sharing.** **Status: missing.** From a private channel and DM run a three-person real audio/video call across desktop and phone, share a window, read captions, switch devices, interrupt networking and reconnect. Remove a participant and deny further media access; an outsider cannot join with a copied link. Refused microphone/camera permission and failed relay show actionable states. At 50 participants with 25 cameras on across desktops and phones, measure p95 join time ≤ 3 s, audio continuity (no gap over 500 ms in a 10-minute session on the target network) and screen-share legibility (10-pt text readable at 390 width); a 51st joiner sees the full state.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-023 — Zoom, Google Meet and Teams meetings.** **Status: missing.** For each named provider connect a test tenant, create and join from a channel and DM on phone/desktop, reschedule then cancel, and revoke consent. Observe provider-confirmed links and honest failure; a private recording link never broadens provider access.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-024 — Asynchronous clips, transcripts and call artifacts.** **Status: missing.** Record a clip from phone and desktop, play with captions and seek from transcript; record a consented huddle and inspect its audience. Reject an outsider, simulate failed processing, correct a transcript and export/delete or hold the artifact without losing policy state.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-025 — App and bot platform.** **Status: missing.** Install an app as owner, subscribe only one channel, post a signed incoming event, invoke a slash command and click an interactive approval. Replay/forge payloads, exceed a rate limit, copy a private event ID and revoke the app: deny escalation, avoid duplicate effects and show delivery/uncertainty with secrets redacted. An app with the DM scope opens one app DM with a member; the member mutes, blocks and unblocks it, and posts are refused while blocked. The member adds the app to a private channel and removes it, and the audit log shows both; the app's token cannot list or read any other DM, group DM or private channel. An app without the channel-management scope cannot create a channel.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-026 — Workflow builder and durable scheduled work.** **Status: missing.** Build a recurring stand-up form that posts a channel summary and proposes work only for explicit acceptance. Publish, trigger once, pause during an approval wait and restart; no duplicate post or unauthorized write occurs. Refuse a revoked connector and expose the failed step plus a safe human resume choice.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-027 — Engineering and project integrations.** **Status: missing.** Connect each named service, route a selected project/repository event, act from a card and follow a linked issue/PR from open to complete to reopened. Retry its webhook, remove source permission and revoke the grant: exactly one authorized effect and no leaked project context. Vector remains the authoritative work record.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-028 — Support, sales and operational signals.** **Status: missing.** For each named service route a real sandbox case/account/alert event, inspect an authorized preview, approve a supported write and observe source-confirmed state. Deliver duplicate/recovery events, disconnect the source and remove channel access; keep one linked thread, no false completion and a visible failed/uncertain action.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-029 — Connected documents and knowledge.** **Status: missing.** Connect each named provider, share an authorized document into a matching channel, retrieve its card/text as an allowed member and refuse a source-denied member. Revoke provider sharing or disconnect, refresh search/agent context and show unavailability without cached excerpts or broadened access.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-030 — Calendars, availability and meeting reminders.** **Status: missing.** Connect both calendars, create a cross-time-zone meeting from a DM, accept/change/cancel it at the provider and see exactly one current card/reminder. Show free/busy without private title access, cross a daylight-saving transition and revoke the grant before a scheduled action. Turn on calendar-driven status: a private meeting sets "In a meeting" without its title and clears at its end, and a hand-set status is left untouched.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-031 — Shared channels between organizations.** **Status: missing.** Two independently administered organizations approve a channel, exchange messages/files/calls and install one narrowly scoped bot; start and accept an external DM, then block it through one organization's policy. Exercise a single-channel guest, denied directory lookup, conflicting retention/export policy, member removal and full org disconnect. Every client/search/agent/API loses revoked access while permitted historical copies are explicitly accounted for.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-032 — Recurring quiet schedules and notification policy.** **Status: partial.** Set a weekday quiet schedule and channel override, cross midnight/DST and restart without a page open. Send routine/mention/urgent events and a message containing the recipient's keyword "invoice" from another account (one keyword item in a readable channel, none in a muted or unreadable one), read on a second device and compare the activity feed, held items, badges and provider attempts with the recipient’s stated rules.

  Current evidence: `src/platform/storage/commands.ts`; `src/notify/run.ts`; `src/push/run.ts`; `tests/attention.mjs`; `tests/notify-journey.mjs`. One-off quiet time, mute/follow and recipient urgency choices ship; recurring/time-zone/device schedules and keyword notifications are missing.

- **NOOK-033 — Personal and channel reminders.** **Status: partial.** Schedule a personal message reminder and recurring channel reminder, close every client and restart before due. Observe one eligible reminder at the chosen time, snooze/edit/cancel it, revoke the creator’s channel access and confirm no unauthorized later post.

  Current evidence: `src/family/team-chat/attention.ts`; `src/platform/storage/commands.ts`; `tests/attention.mjs`. Attention snooze supplies a foundation; arbitrary reminders, recurrence and channel scheduling are missing.

- **NOOK-034 — Scheduled and recurring messages.** **Status: missing.** Schedule a one-off and weekly stand-up, change the time across DST, restart at due time and replay a scheduler claim. See one post per occurrence, then pause/cancel and remove posting access: no new post or hidden failure.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-035 — Channel recaps and catch-up digests.** **Status: missing.** Request a channel/thread recap and daily unread digest over contradictory discussions and inaccessible channels. Check every factual point against a source link, remove access before delivery, correct a claim and cancel the schedule. No private snippet or invented acceptance survives.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-036 — AI search with cited answers.** **Status: missing.** Ask an answerable, contradictory and unanswerable question with private files and a hostile document in the corpus. Follow citations, revoke a source and repeat as a different member: deny cross-scope context, abstain where unsupported and perform no embedded instruction or external write.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-037 — SSO, SAML and lifecycle provisioning.** **Status: missing.** Use test tenants for all three IdPs, enforce SSO, rotate signing keys and reject wrong audience/issuer/replayed/expired assertions. SCIM-create a group/member, map one channel, suspend/delete and replay the event; every client and grant loses access without deleting preserved evidence. Exercise audited owner recovery without a blanket bypass.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-038 — Retention, legal hold and preservation.** **Status: missing.** Apply a short retention policy, hold a selected member/date range, edit/delete held messages and expire their files. Ordinary participants lose deleted content, a custodian preserves exact history, and an unauthorized admin cannot retrieve it. Release the hold and finish the queued erasure with actual byte verification and audited counts.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-039 — Compliance search and controlled exports.** **Status: missing.** Open a case, obtain required approval, export a held DM/file plus revision history and verify manifest completeness and hashes. Try the same through an ordinary admin session and deny it. Revoke the custodian mid-job, expire the download and inspect a durable audit of search, approval and retrieval.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-040 — Information protection and data handling.** **Status: partial.** Label a private channel, attempt a restricted external share, connector post, export and AI retrieval, and observe the configured block/warning. Exercise an approved override and revoke it; inspect policy history, secret redaction and deletion of derived content after source erasure.

  Current evidence: `src/platform/storage/context.ts`; `src/platform/storage/files.ts`; `src/push/crypto.ts`; `tests/team-security.test.mjs`. Current-membership private-message/file access and encrypted push exist; labels, DLP, organization AI policy and cross-tool enforcement are missing.

- **NOOK-041 — Slack migration and cutover.** **Status: partial.** Use an authorized real Slack workspace export plus synthetic adversarial coverage, preview without writes, resolve an identity collision and a missing file, import public/private/DM/shared histories, verify complete counts/bytes/threads/search and deny outsiders. Interrupt/resume and undo a batch after native activity, confirming refusal where undo would destroy that activity. The preview lists every integration in the export with its disposition, and repointing one incoming webhook delivers to the mapped channel. **Slack Pro consented path:** on a Slack Pro test workspace with a private channel, a 1:1 DM, a three-person group DM, custom emoji, a user group and files, import the official public-only ZIP, then have members grant their Slack user tokens. Two of three group-DM members consent: the group DM stays unpublished and the cutover report lists it with its member count and the missing consent. Both 1:1 participants consent: the DM imports with its threads and file bytes and only those two can read it. The private channel's manager consents: it imports to its exact membership. Revoke one member's grant mid-run and see no further fetch with that token in the Slack request log. An outsider, and the owner and an admin who are not members, find none of this content by search, link, export or API. Custom-emoji reactions and an `@group` mention render after import.

  Current evidence: `src/imports/archive-plan.mjs`; `src/imports/history.ts`; `src/imports/ImportWizard.tsx`; `src/imports/slack.mjs`; `tests/slack-import/journey.mjs`; `tests/pilot-journey.mjs`. Reviewed resumable public-channel JSON ZIP history, file choices, threads, bot provenance and guarded undo ship on synthetic fixtures; private/DM/shared import (including the consented member-token path for Free/Pro exports), custom emoji and user-group import, the integration inventory with dispositions, full metadata parity and real-source cutover remain missing.

- **NOOK-042 — Microsoft Teams migration.** **Status: missing.** Extract a real test tenant containing channels, private/shared channels, 1:1/group/meeting chats and protected files; page every source set, preview, import and verify counts, chronology and visibility. Revoke an export scope, interrupt/resume and undo without deleting later native work; show each omission.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-043 — Google Chat migration.** **Status: missing.** Import a real Workspace test export with spaces, threaded replies, DMs and files plus an externally owned space omitted by source policy. Compare coverage and exact visibility, interrupt/resume and undo after native activity, and confirm no notifications, accepted tasks or outsider access.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-044 — Campfire ONCE migration.** **Status: missing.** Take a consistent real Campfire test-instance backup with open/closed rooms, DMs and uploads, preview and migrate it, then compare messages/files and deny unrelated members. Reject an incomplete/unsupported backup and exercise resume and safe undo.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-045 — Zulip migration and topic continuity.** **Status: missing.** Export a real Zulip test organization with two topics in one channel, private conversations and uploads; import and navigate each topic independently, inspect consent omissions and verify private audiences. Resume once without duplicates and undo while preserving later native work.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-046 — Mattermost migration.** **Status: missing.** Export a real Mattermost test deployment spanning two teams, private channels, DMs, replies, saved/pinned items and attachments. Review/map roles, import and find every declared item while denying outsiders; interrupt/resume and undo without removing subsequent Nook messages.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-047 — Readable portability and controlled exit.** **Status: partial.** Export a populated workspace and a member-scoped conversation, read the HTML offline and enumerate JSON/file hashes against the source. Attempt another person’s DM as an ordinary admin, cancel/resume a large job, and verify all omissions are named. A successful operational backup alone does not prove readable exit.

  Current evidence: `src/platform/storage/portability.mjs`; `src/platform/portability.server.ts`; `tests/exit-export.test.mjs`; `tests/team-portability.test.mjs`. Complete owner/operator backup with media and provenance ships; human-readable/selective exit and future feature exports remain missing.

- **NOOK-048 — Team administration and reporting.** **Status: missing.** Populate a US 35-person team with guests, a private management channel, missed notifications and overdue linked work. Compare filtered report totals to authorized records, export CSV, remove a viewer’s access and verify both aggregates and drill-through stop exposing that scope; show a failed sync as incomplete data. Repeat totals and drill-through at the NOOK-049 capacity installation (1,000 members, 5,000 channels).

  Current evidence: No implementing source/test; journey pending..

- **NOOK-049 — Reliability, performance and operating recovery.** **Status: partial.** On the supported hosted configuration, seed 1,000 members, 5,000 channels, 25 million messages over 7 years and 2 TiB of files; drive 1,000 connected clients at 50 messages/s with 200/s bursts and a 1,000-member default channel, and measure sent-to-visible p95/p99, last-recipient fanout, 24-hour reconnect catch-up, complete reconnect count and search latency against the stated objectives. Page the people directory and channel browser past 1,000 and 5,000 entries and find the last entry by search. Interrupt fanout/provider access, restart workers, upgrade without data loss, restore from an owned backup within RTO and compare outcomes to the published objectives and component status.

  Current evidence: `src/platform/storage/live.ts`; `src/platform/storage/messages.ts`; `scripts/storage/measure.mjs`; `tests/storage-flows.mjs`; `tests/recovery.test.mjs`. Normalized D1/R2, Durable Object replay and local restart/restore checks exist; hosted service levels, media/platform failure recovery, directory paging past 1,000 and the stated capacity objectives remain unproven.

- **NOOK-050 — Owned installation and Base replacements.** **Status: partial.** Follow README installation, first-run setup and invited sign-in; upgrade existing data, run doctor, export/reset/recover and use the configured hosted owner claim. Check invalid config and missing secrets fail closed, operator disk custody is disclosed and no private value reaches logs/builds. Reproduce on a real supported owner account and inspect actual USD provider usage separately from local/fake-account tests. Install with an explicit data jurisdiction and confirm setup and doctor show it. Open the published reference cost for 50 and 300 members, check its unit costs and assumptions against the measured release figures, and compare the installation's actual cost per active member with it.

  Current evidence: `src/platform/operator-auth-runtime.mjs`; `src/platform/owner-claim.server.ts`; `src/platform/portability.server.ts`; `scripts/installer/local.mjs`; `tests/installer-workflow.mjs`; `tests/owner-deploy.test.mjs`; `tests/part6.mjs`. Base-backed local lifecycle, owner claim, portability and fake-account deployment checks exist; live hosted/provider/native operating proof, data-location choice, full cost reporting and the published 50/300-member reference cost are missing.

- **NOOK-051 — Auditable authority and actions.** **Status: partial.** Exercise membership revocation, export, erasure and an approved bot/workflow action, then filter/export their log through admin doors. Deny members and an erased actor; anonymize that actor and retain the action facts. Interrupt an external step and see uncertainty rather than a forged completion.

  Current evidence: `src/team/erasure/audit.ts`; `src/base/modules/operator-auth/accounts/admin.mjs`; `tests/erasure.test.mjs`; `tests/operator-auth.test.mjs`. Auth and anonymized erasure audit foundations exist; unified administrator log, hold/export/app/agent coverage and filters are missing.

- **NOOK-052 — Accessible, responsive daily use.** **Status: partial.** At both widths and on native clients, use keyboard and VoiceOver/NVDA to send/reply/search, accept work, upload, join a captioned call, migrate, change a policy and pause an agent. Inspect realistic long names/history, enlarged text, focus after deletion/reconnect and error announcements; run scoped automated accessibility checks and record manual limitations.

  Current evidence: `src/chat/accessibility.css`; `src/chat/dialog-focus.ts`; `tests/accessibility.mjs`; `tests/keyboard.mjs`; `tests/browser.mjs`. Responsive/keyboard and bounded axe coverage exist for current conversations and erasure; new surfaces and complete assistive-technology conformance lack evidence.

- **NOOK-053 — Conversation notes and lightweight lists.** **Status: missing.** Create and revise a private channel note/checklist, link a provider document, propose an item to another person and require their exact acceptance. Remove a member, export history and delete/hold the note; all sources keep their distinct permissions and authority.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-060 — Organization policy and channel lifecycle.** **Status: partial.** As owner create a delegated channel admin and a user group, rename/archive/restore a populated channel, transfer ownership and schedule guest expiry. Preview/refuse a private-to-public conversion that would expose earlier history, exercise group mentions and custom emoji, and deny app/compliance/DM operations outside the delegated grant. Verify expiry/revocation across phone, desktop, search and bot access. Restrict channel creation and guest invitation to admins and set a 15-minute edit window: a member's create, invite and late edit are refused through app and API, and a new member auto-joins both default channels.

  Current evidence: `src/team/channels.server.ts`; `src/team/access.ts`; `src/team/invitations.server.ts`; `tests/team-runtime.mjs`; `tests/team-security.test.mjs`. Basic channel creation, browse/join and scoped guest access ship; custom roles/groups, channel archive/transfer, expiry, enumerated workspace settings, default channels and full organization policy are missing.

- **NOOK-061 — Any office file, large uploads, previews and malware scanning.** **Status: partial.** Upload and download a .docx, .xlsx, .pptx, .csv, .zip, HEIC photo, animated GIF and an MP4 screen recording within 5% of the 1 GiB limit at 1440 and 390 and on native clients; interrupt one upload mid-way and resume it with no duplicate; preview each type in-app and compare downloaded bytes by SHA-256. Upload the EICAR test file and see it quarantined for uploader and recipients with no download or preview path. Stop the scanner and see new files held as scanning. Block `.exe` as admin and see app, API and webhook uploads refused with no stored bytes; a file of 1 GiB plus one byte is refused.

  Current evidence: `src/platform/storage/files.ts`; `src/team/preview.server.ts`; `tests/team-image.test.mjs`; `tests/storage-flows.mjs`. 25 MiB private R2 uploads, signature checks and PNG/JPEG preview exist; any-type 1 GiB resumable uploads, office/HEIC/GIF/video previews, malware scanning and admin file-type policy are missing.

- **NOOK-062 — Notification previews and actionable replies.** **Status: missing.** With previews at the default, mention a member whose iOS and Android devices are locked: each lock screen shows sender, conversation and message text. Turn on the org cap forcing `sender` and send again: the same event shows sender and conversation only, and the delivered payload contains no text. Turn on email text and see it in the received email; turn it off and see the next email without text. Reply from the lock-screen notification on both phones and from a desktop notification, drop the network once and retry: exactly one message posts under current membership. Remove the member from the channel and reply from a stale notification: the reply is refused with a visible failure. Mark as read from a notification and see unread, badge and the other device's notice clear.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-063 — Slack-compatible webhooks and Web API.** **Status: missing.** Repoint an unmodified GitHub Actions `slackapi/slack-github-action` incoming-webhook step and a curl `{"text","blocks","thread_ts"}` payload to a Nook webhook URL: both render with their blocks and the threaded one lands in its thread. Run an unmodified `@slack/bolt` JavaScript app and a Python `slack_sdk` script with only base URL and token changed: `chat.postMessage` then `chat.update` edits one message; signed `message` and `reaction_added` events arrive once across a forced retry; a slash command answers ephemerally and through `response_url`; a button click returns `block_actions`. The same Bolt app calls `conversations.open` for a user and `chat.postMessage` into the result: that person receives one app DM showing the app identity. It creates `#inc-123`, invites three responders, sets its topic and lists them with `conversations.members`; schedules a message with `chat.scheduleMessage` that posts once at its time; and advances a modal with `views.push` and `views.update`. The person blocks the app and the next DM is refused with `messages_tab_disabled` and posts nothing; a second app without the channel-management scope gets `missing_scope` from `conversations.create`; and no other DM or group DM is readable through either token by `conversations.history`, `users.conversations` or events. Post an unsupported block and see the text fallback, visible notice and warning. Forge a signature, replay an old timestamp, post to an owners-only channel without permission and revoke the token: each is refused with Slack's error string and no message.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-064 — Zapier, Make and n8n connectors.** **Status: missing.** In a real Zapier account, run zaps end to end: a Nook "new message in #sales" trigger appends a Google Sheets row, and a Google Forms submission runs Nook "send channel message" and "request approval"; decide the approval and see the decision trigger fire once. Repeat one trigger-plus-action scenario in Make and one workflow in n8n. A "propose commitment" action stays proposed until the assignee accepts. Revoke the grant and see the next run fail visibly with no post.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-065 — Channel-wide mentions: @channel, @here and @everyone.** **Status: missing.** In a 120-member channel with mixed choices, @channel creates Attention, push and email for every eligible member per their choices (none for the sender, muted or ignore-broadcast members; deferred for members in quiet time) and the delivered count equals 119 minus those exclusions. @here with 30 members in fresh presence reaches exactly those 30. @everyone in the default channel reaches every active non-guest and is refused in another channel. Send through the API without confirmation and receive 409 with no message; confirm and see one send. A member outside an owners-only broadcast policy, and a webhook `<!channel>` from an app without that permission, are refused with no message.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-066 — Channel posting permissions and announcement channels.** **Status: missing.** Set #announcements to owners-only posting with replies off. A member's post, thread reply, notification reply, Slack-compatible webhook post, Zapier action, workflow post and a scheduled message created before the change are all refused (the scheduled one as a visible failed occurrence), while the member still reads, reacts and saves. An owner posts; an admin override post is labelled and appears in the audit log. Open replies and see the member's thread reply accepted.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-067 — Forwarding messages and email into conversations.** **Status: missing.** Forward a public-channel message with a note into a DM on desktop and phone and see author, source and note. Forward a private-channel message to a public channel as Link only: a public member without private access sees attribution but no body, attachment or thread, and the link refuses them; forward it as Show message and see the disclosure preview and audit entry. Set owner policy to link-only and see Show message refused. Delete the source and see each forwarded copy tombstoned. Email a PDF to a channel's address and see one attributed post; with allow-listing on, an unlisted sender is refused.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-068 — Safe link previews and app unfurls.** **Status: missing.** Paste a public article URL and see title, description and image preview with the image served from Nook; paste a YouTube and a Loom link and see their oEmbed previews. Paste links resolving to 127.0.0.1, 10.0.0.5 and 169.254.169.254 and a public URL that redirects to an internal address, and confirm through the fetch log and a listening internal server that nothing internal is contacted. An installed app with a claimed domain unfurls its own link once the author approves. The author removes a preview and it stays removed after reload on another device; an admin denies a domain and its links get no preview.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-069 — Two-factor authentication without SSO.** **Status: missing.** As owner, enforce 2FA. A member without a factor signs in by magic link and reaches only enrolment: every private API, SSR page, live socket and export is refused until they enrol with TOTP; a second member enrols a passkey on desktop and phone. A captured magic link used from another browser opens no private access without the second factor. Use a recovery code and see it audited and emailed; an admin resets a member's factors and the audit log, revoked sessions and notice show it; repeated wrong TOTP codes lock out with audit. The member opens their own sessions list, sees a phone and two browsers, signs out the phone and then all others: the phone loses private access and push at its next contact and the other browsers return to sign-in.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-070 — Polls, GIFs, thread broadcast, bookmarks and translation.** **Status: missing.** Create a named and an anonymous poll, vote from desktop and phone, close it and see the final count; a non-member cannot vote. Post a GIF through search under the rating cap, then disable GIFs as admin and see the picker gone. Send a thread reply also to the channel, edit then delete it and see both places update once. Add, reorder and remove channel bookmarks as a permitted member and be refused as a restricted one. Translate a Spanish message into English and return to the original.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-071 — Threads view and group-DM conversion.** **Status: missing.** Follow three threads across two channels and a DM, receive replies and see them in the Threads view with unread counts at 1440 and 390; reply inline, mark one read and see it read on a second device; lose membership of one channel and see its thread leave the view. Convert a three-person group DM into private channel `#proj-x`: its members are exactly those three, its history is present, the group DM is read-only with a link, an outsider cannot discover either, and the audit log shows the conversion.

  Current evidence: No implementing source/test; journey pending.

- **NOOK-054 — Scoped company-context agents and MCP.** **Status: missing.** Provision a channel agent and read-only MCP client, connect a permission-scoped document and request a summary/post. Deny access to a second private channel, an unlisted tool and a malicious source instruction; revoke membership/grants mid-run and verify no cached context or further tool write escapes.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-055 — Accountable commitment assistant.** **Status: partial.** Discuss a vague request, a declined ask and an agreed ask. The assistant proposes only a cited candidate; deny author/agent acceptance on behalf of the assignee. Accept, revise a due date and close linked work: require renewed agreement and assignee completion, then pause the agent and verify no further chase or external write.

  Current evidence: `src/platform/storage/outcomes.ts`; `src/family/team-chat/attention.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs`. Human proposals, exact assignee acceptance, revision and completion reports ship; agent extraction, evidence tracking and controls are missing.

- **NOOK-056 — Decisions that stay current.** **Status: partial.** Record a decision, change its linked authorized project/document to contradict it and produce a source-cited proposal for the original author. Make one source private and one stale, dismiss a false positive and revise the decision as its author; deny automatic/foreign revision and any wider audience leak.

  Current evidence: `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs`. Human versioned decisions and source links ship; contradiction monitoring and proposed agent resolution are missing.

- **NOOK-057 — Calm follow-through across linked systems.** **Status: partial.** Accept a commitment linked to a PR and support case, deliver duplicate and out-of-order source events, then close/reopen one dependency and revoke another connector. Receive one calm evidence-linked update, an accurate blocked/unknown status and a proposed resolution; deny unauthorized writes and preserve assignee-only completion.

  Current evidence: `src/notify/run.ts`; `src/family/team-chat/attention.ts`; `src/platform/storage/outcomes.ts`; `tests/notify-journey.mjs`; `tests/attention.mjs`. Human obligations and calm routing ship; connected-system reconciliation, batched agent updates and external-action grants are missing.

- **NOOK-058 — Stale handoffs and proposed resolution.** **Status: missing.** Leave a handoff unaccepted, let an accepted dependency become overdue, then provide late evidence and an alternate suggested assignee. The agent separates those states, proposes a cited resolution to the permitted people, stops after resolution/pause and requires the new assignee’s own acceptance.

  Current evidence: No implementing source/test; journey pending..

- **NOOK-059 — Visible and controllable agent execution.** **Status: missing.** Start a scheduled handoff run, inspect and decline a proposed external write, interrupt the model/provider after a step, restart and revoke the grant. The owner sees a durable failed/uncertain state and exact remaining action; no duplicate write, resumed revoked access or unapproved commitment appears.

  Current evidence: No implementing source/test; journey pending..

**73 target clauses: 16 done, 19 partial, 38 missing.** These counts describe source/test coverage, not a new claim that all target acceptance has run.
