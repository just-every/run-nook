# Nook target product contract

Nook is an owned team workspace for a US small or mid-size team switching from Slack, Microsoft Teams or Google Chat. Channels, DMs and threads connect dependable conversation to decisions and commitments, with native clients, calls, integrations and accountable agents as target obligations.

## Product target

| | |
| --- | --- |
| Category | Team chat and workplace messaging |
| Incumbents a buyer switches from | Slack, Microsoft Teams, Google Chat |
| Up-and-comers it must also beat | Campfire (37signals ONCE), Zulip, Mattermost |
| First buyer | A US small or mid-size team; US English, USD costs, US time zones and daylight saving, US identity, privacy and records norms |

The primary journey: Install Nook, invite the team, review and import their history, talk in channels and DMs, record decisions, accept commitments and follow through with calm Attention.

## How to read this contract

- This follows the RER contract standard and preserves the complete product target.
- Core is first-week switching work and push-further; Agent surface is the specialist door; Later keeps non-core obligations visible.
- Done means every acceptance outcome has recorded proof; partial names delivered scope and missing proof.
- Field proof is visible separately and does not replace reproducible acceptance.
- ACCEPTANCE.md, docs/CLAIMS.md and the Status summary are generated from this file.

## Door rules

- **D-1.** Conversation audience. A fixed DM roster or current channel membership governs Nook context. An administrative role adds no DM participant; disclosure into another conversation uses the destination audience and its posting policy.
- **D-2.** Imported history. Import is inert history: it creates no unread, Attention, notification, automatic follow, workflow run or accepted commitment. Reviewed source identity and audience remain distinct from later native work.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | none | not run |
| BASE-ACCESS-002 | Sessions | NOOK-001, NOOK-007, NOOK-069, NOOK-115 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | NOOK-001 | not run |
| BASE-INPUT-001 | Validation | NOOK-007, NOOK-013 | not run |
| BASE-INPUT-002 | HTML | NOOK-007, DOCS-001 | not run |
| BASE-INPUT-003 | Uploads | NOOK-012, NOOK-024, NOOK-061, NOOK-110 | not run |
| BASE-SECRET-001 | No leakage | NOOK-007, NOOK-015, NOOK-098, NOOK-036, NOOK-040, NOOK-050, NOOK-108, NOOK-079, NOOK-087 | not run |
| BASE-SECRET-002 | Startup | NOOK-050, NOOK-108 | not run |
| BASE-DATA-001 | Export and import | NOOK-006, NOOK-009, NOOK-012, NOOK-013, NOOK-047 | not run |
| BASE-DATA-002 | Retention | NOOK-038 | not run |
| BASE-DATA-003 | Erasure | NOOK-012, ERASURE-001 | not run |
| BASE-DATA-004 | Outbound flows | NOOK-014, NOOK-015, NOOK-035, NOOK-036, NOOK-040, NOOK-050, NOOK-108, NOOK-084, NOOK-087 | not run |
| BASE-DATA-005 | Independence | NOOK-050, NOOK-108 | not run |
| BASE-PUBLIC-001 | Privacy | none | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | NOOK-049, NOOK-107 | not run |
| BASE-OPS-002 | Migrations | NOOK-049, NOOK-107, NOOK-050, NOOK-108 | not run |
| BASE-OPS-003 | Idempotency | NOOK-002, NOOK-026, NOOK-063, NOOK-112, NOOK-113, NOOK-114, NOOK-082 | not run |
| BASE-OPS-004 | Failure is visible | NOOK-026, NOOK-049, NOOK-107 | not run |
| BASE-OPS-005 | Audit | none | not run |
| BASE-ROLE-001 | Roles through every door | NOOK-001, NOOK-003, NOOK-009, NOOK-011, ERASURE-001, NOOK-018, NOOK-093, NOOK-094, NOOK-095, NOOK-037, NOOK-039, NOOK-047, NOOK-063, NOOK-112, NOOK-113, NOOK-114, NOOK-080 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | NOOK-039, NOOK-051, NOOK-080 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | NOOK-009, NOOK-049, NOOK-107 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ERASURE-001, NOOK-024, NOOK-038, NOOK-039, NOOK-047, NOOK-053 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | NOOK-018, NOOK-093, NOOK-094, NOOK-095, NOOK-037 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | NOOK-069, NOOK-115 | not run |
| BASE-INSTALL-001 | Free self-host and removal | NOOK-050, NOOK-108 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | NOOK-014, NOOK-015 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | NOOK-052 | not run |
| BASE-DOCS-001 | On-site docs from one contract | DOCS-001 | not run |
| BASE-AGENT-001 | One MCP door per seed | NOOK-054 | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | NOOK-054, SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-005 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | NOOK-079, NOOK-054 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | NOOK-007, NOOK-025, NOOK-098, NOOK-099, NOOK-035, NOOK-036, NOOK-079, NOOK-054, SURFACE-003 | not run |
| BASE-AGENT-006 | Every action declares its risk class | NOOK-040, SURFACE-002, SURFACE-003, SURFACE-004 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | NOOK-025, NOOK-098, NOOK-099, NOOK-026, NOOK-040, NOOK-084, NOOK-054, NOOK-055, NOOK-056, NOOK-057, NOOK-058, SURFACE-006 | not run |
| BASE-AGENT-008 | Truthful attribution | NOOK-004, NOOK-010, NOOK-025, NOOK-098, NOOK-099, NOOK-053, NOOK-055, NOOK-056, NOOK-058, SURFACE-003, SURFACE-004 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | NOOK-051, NOOK-059, SURFACE-006 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-005 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | NOOK-057, NOOK-059, SURFACE-004 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | NOOK-059 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-005, SURFACE-006 | not run |

## Published clauses

- `NOOK-001`: *Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESS-002, BASE-ACCESS-004 · *Rules:* D-1
- `NOOK-002`: *Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-1
- `NOOK-003`: *Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1
- `NOOK-004`: *Tier:* Core · *Cites:* BASE-AGENT-008 · *Rules:* D-1
- `NOOK-005`: *Tier:* Core · *Rules:* D-1
- `NOOK-006`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `NOOK-007`: *Tier:* Core · *Cites:* BASE-INPUT-002, BASE-INPUT-001, BASE-SECRET-001, BASE-ACCESS-002, BASE-AGENT-005 · *Rules:* D-1
- `NOOK-008`: *Tier:* Core · *Register:* R-6
- `NOOK-009`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001, BASE-ROLE-001 · *Rules:* D-1
- `NOOK-010`: *Tier:* Core · *Cites:* BASE-AGENT-008 · *Rules:* D-1
- `NOOK-011`: *Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1
- `NOOK-012`: *Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-001, BASE-DATA-003 · *Rules:* D-1
- `NOOK-013`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-DATA-001 · *Rules:* D-1
- `NOOK-014`: *Tier:* Core · *Cites:* BASE-MAIL-001, BASE-DATA-004 · *Rules:* D-1 · *Register:* R-6
- `DOCS-001`: *Tier:* Core · *Cites:* BASE-DOCS-001, BASE-INPUT-002
- `ERASURE-001`: *Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006, BASE-ROLE-001 · *Rules:* D-1, D-2
- `NOOK-015`: *Tier:* Core · *Cites:* BASE-MAIL-001, BASE-DATA-004, BASE-SECRET-001 · *Rules:* D-1 · *Register:* R-6

### Published core clauses

#### NOOK-001 — Current identity and conversation membership (C1)

**Requirement.** Conversation scope is the fixed DM roster or current channel membership, including search, replay and outcome views. A workspace administrative role adds no DM participant.

**Acceptance.**
1. Through signed-in HTTP, SSR, search, replay and generated loaders, remove a conversation participant; subsequent reads and writes to that conversation are refused, including a workspace admin attempting another person’s DM.

#### NOOK-002 — Atomic messages, retries and replay (C2)

**Requirement.** Messages commit atomically with per-conversation event sequence and client intent key. Identical retries return the same message; changed retry payload conflicts. Replay pages preserve ordering; edits use compare-and-swap versions; deletes tombstone and erase original body from live revisions.

**Acceptance.**
1. Send through the conversation API, repeat the same intent after a lost acknowledgment, then change its payload; observe one ordered message, the original retry result and a conflict for changed intent.
2. Race edits and delete; replay shows current tombstones without deleted bodies.

#### NOOK-003 — Fixed DMs and channel membership (C3)

**Requirement.** DMs have fixed participants. Channel owners control membership. New members see entire channel history; UI and docs must disclose this.

**Acceptance.**
1. Create channel/private/DM conversations through the app, add a channel member after earlier messages, and observe full-history disclosure and access.
2. Remove that member and deny history/search/replay/files immediately; refuse DM participant changes and unrelated-admin DM access.

#### NOOK-004 — Decisions and commitments (C4)

**Requirement.** A person's decision has that author, conversation scope and immutable version history. A revision is attributed to the author who acts and compares the version; an agent's equivalent decision carries commitment, decided by the company's policy, without impersonating that person. A commitment can become accepted only through the assignee's action. Completion is reported, never labeled verified.

**Acceptance.**
1. From a discussion, record a decision and propose a commitment.
2. Another participant cannot revise the decision or accept for the assignee; the assignee accepts the exact version and reports completion.
3. Reopen history and see human authorship, source context and reported status.

#### NOOK-005 — Read cursors and attention (C5)

**Requirement.** Read cursors persist per user and conversation, are monotonic and cannot exceed durable frontier. Attention/unread is separate from accepted responsibility.

**Acceptance.**
1. Read a thread from two sessions, reconnect one, and observe monotonic unread recovery with own sends excluded.
2. Refuse read markers beyond the durable frontier; closing Attention does not accept work or mark unseen messages read.

#### NOOK-006 — Offline restore (C6)

**Requirement.** Recovery is offline into an empty installation. Nook recovers conversation membership, outcome versions, Attention and private file bytes with explicit identity mapping; legacy password hashes are recovery input and create no sign-in authority. Restoring history revives no pending delivery.

**Acceptance.**
1. Use rer export/reset/import into an empty stopped installation, complete explicit identity recovery, and compare conversations, memberships, outcome versions, attention and downloaded file bytes.
2. A populated destination, altered checksum or invalid graph is refused; no old delivery or session revives.

#### NOOK-007 — Safe rendering and local binding (C7)

**Requirement.** Conversation text and imported or model-supplied content have no ambient authority to start a provider action. Authorized app, specialist and meeting effects use their scoped doors; the company's policy decides an agent call's computed classes. Link previews use NOOK-068's bounded service. Legacy credentials are offline recovery inputs only. Local Nook development binds only to loopback; production uses HTTPS and excludes dev admission.

**Acceptance.**
1. Post conversation, imported and model-supplied content requesting code, client-side or credentialed fetches or provider effects; no ambient conversation authority starts them outside the scoped app, specialist and meeting doors.
2. Cross-origin mutations and unsafe local origins fail; production output excludes dev admission.

#### NOOK-008 — Evidence limits (C8)

**Requirement.** Release reporting distinguishes local public-door proof, provider acknowledgment, observed device display, human reading and action. Failed or unmeasured results stay visible. Field receipts are separate from reproducible acceptance, and never substitute for it.

**Acceptance.**
1. Reproduce the local release-candidate public-door journeys and publish their measured outcomes.
2. Keep failed or unmeasured end states visible without presenting provider acceptance as device display or human reading.

#### NOOK-009 — Backup and export (C9)

**Requirement.** Two full-backup custody paths cover Nook records, private file bytes and the erasure journal. The local filesystem operator acts outside app privacy on a stopped installation. Hosted backup is an active-owner download with no remote restore; a database-only dump cannot satisfy it. Restore validates conversation identities, references, schema and event/read frontiers with explicit identity recovery. User-readable policy-scoped exit remains NOOK-047. [Backup procedures](docs/backups.md) describe both paths.

**Acceptance.**
1. Local: Stop the install, export with `rer export`, import into an empty stopped local install, complete explicit identity recovery and re-export; compare equivalent records, private media bytes and erasure journal.
2. Hosted: Sign in as an active owner, follow the hosted backup/export path through the browser backup download and the documented operator command to download D1 records plus R2 bytes into an owner-held archive, import it into an empty stopped local install and complete identity recovery; compare records, file bytes, rebuilt search and erasure journal.
3. Reject non-owner/expired hosted sessions and any remote restore.
4. Inspect both archives for private records and media, with live credentials, devices and pending deliveries excluded.

#### NOOK-010 — Commitment revision and cancellation (C10)

**Requirement.** Material text/deadline revision requires renewed assignee acceptance at the exact new version. Assignee and conversation are fixed; changing assignee means explicit cancellation and a fresh proposal, and scope cannot move across conversations. Cancellation is explicit, terminal and versioned; authors may cancel proposals/accepted work but cannot claim assignee completion. Deleted source refs become null; event rows preserve opaque sequence/object facts, never message bodies. Replay clients fetch current object state under current ACL and interpret tombstones.

**Acceptance.**
1. Accept a proposal and revise its text/deadline: renewed acceptance is required at the new version.
2. Cancel and create a new proposal to change the fixed assignee.
3. Refuse stale acceptance, cross-conversation moves and author impersonation of completion; cancellation stays terminal in history and deleted source refs reveal no body.

#### NOOK-011 — Cached retries, synchronization and complete history (C11)

**Requirement.** Cached retry responses require current ACL before lookup. Reads synchronize monotonically across sessions; replay cursors indicate per-conversation sequence and bounded catch-up, not read receipts. History pages must cover the complete tested log rather than silently truncate.

**Acceptance.**
1. Page beyond the tested history window and reconnect after missed edit/delete events.
2. Repeat a previously successful intent after membership revocation; it must be denied before cached response lookup, with no missing or duplicated durable history.

#### NOOK-012 — Private attachments (C12)

**Requirement.** Private attachments keep uploader-only staging, ordered same-conversation binding, exact retry identity and private byte custody. Admission is 1 byte to 25 MiB, five files per message and 50 staged uploads per uploader, without an aggregate workspace quota. Staging is eligible for 24 hours and creates no Attention; unused bytes await explicit removal. Signature-checked PNG/JPEG and bounded opt-in text previews stay private; downloads are forced attachments, with no PDF inline or scanning claim. Deleting a file or its message erases live bytes, names and checksums. Archive compatibility preserves the same custody; NOOK-061 widens file admission without reducing it. [Attachment formats](docs/contract/mechanism.md#nook-012) define validation and legacy recovery.

**Acceptance.**
1. Upload and bind ordered private files through the app, preview genuine PNG/JPEG and download exact bytes as an authorized participant.
2. Deny outsiders and removed members, reject active/corrupt/oversized input, recover lost-put acknowledgments and verify deletion and backup round-trip.

#### NOOK-013 — Calm attention (C13)

**Requirement.** Attention is per-person triage, separate from unread and work acceptance. Explicit conversation and root-thread follows persist across sessions; mute suppresses routine follows without suppressing explicit mentions or commitment proposals. Members see notified names and urgent reasons, including when they were not recipients. Urgent requires named recipients; committed retries preserve their original recipients. Routing orders urgent, mention, thread-follow and conversation-follow; proposals and revisions reach assignees, assignee actions reach authors, and own actions create no self-Attention. Quiet time defers routine items; snooze becomes eligible when due, within seven days. Done changes only triage; reads and work acceptance do not close Attention. Tombstoned sources disclose no copied body or urgent reason. Automatic follows use NOOK-072. [Attention compatibility](docs/contract/mechanism.md#nook-013) covers archived state and admission.

**Acceptance.**
1. At 1440 and 390, follow a thread, mute its channel, send explicit mentions/urgent requests, snooze and complete triage, and enter quiet time.
2. Restart and sign in elsewhere: preferences persist, due items return under current ACL, and neither triage nor reads accepts responsibility.
3. Automatic follows from authoring, replying, mentions and one-to-one DMs are proved under NOOK-072; an unfollow through the explicit unfollow action ends one.

#### NOOK-014 — Email notifications (C14)

**Requirement.** Email is a member-owned notification channel to their verified sign-in mailbox, initially off. Separate choices cover mentions/commitments, urgent requests and urgent-through-quiet. Eligible events are mentions, urgent requests, commitment proposals/material revisions to assignees and completion reports to authors; routine follows, reactions, unmentioned replies, accept/cancel updates and imports send none. Each send rechecks choice, active identity, source access, read/done and erasure; canceled items retain their reason. Five-second gathering and ten-minute conversation folding bound bursts. Retry timing and refusal/uncertainty handling follow the [notification protocol](docs/contract/mechanism.md#nook-014); recipient, originating member and owner see failure reasons for seven days. Mail shows sender, conversation and link, with no body, file name, urgent reason or commitment wording; NOOK-062 adds member-selected previews. Unsubscribe changes all choices only after its explicit button action. No open page is needed, restart preserves pending work, restore revives no queue and erasure clears affected choices/items. Local development sends and stores no mail. Web Push is NOOK-015; urgent is not paging.

**Acceptance.**
1. Run the emitted-Worker notification journey through sign-in and settings with only the provider network edge substituted: opt in, mention/propose, fold bursts, hold quiet items, cancel read/deleted/revoked items, restart a retry, expose refusal/uncertainty and use the scanner-safe unsubscribe POST.
2. Inspect that mail contains no private body or file name.


### Native normalized storage (Part 3)

#### DOCS-001 — Public documentation from Markdown

**Requirement.** Nook accounts for every root and guide Markdown document as a published guide or a documented maintainer-only exclusion. Missing sources, broken links and heading anchors fail the build; raw HTML is reported and stays inert. The documentation routes coexist with the Lobby and private workspace.

**Acceptance.**
1. Build and open the guides; every declared page renders, links and anchors resolve, raw HTML remains inert, and every root/docs Markdown source is published or has a recorded exclusion reason.
2. The app Lobby and private workspace keep their existing routes.

#### ERASURE-001 — Member, message and imported-author erasure

**Requirement.** Current owners/admins may erase accessible channel messages; roles never open an operator DM door. Authors retain their own delete/remove actions. Owners may erase eligible other members; admins only accounts with the member role, including guest access; self and the last active owner are refused. Count-only preview, explicit confirmation and a subject-free receipt accompany operator erasure. Authored content, credentials and selected import copies are erased; authored work retains only scope/kind/version count/state. Other authors retain work and state without erased assignee/action attribution. Shared conversation notes are such work: member erasure removes only the member's author, reviser and pin attribution, and a note another member authored or revised keeps its title, text, checklist items, links, pin state and every snapshot for the other participants; notes the member wrote alone, and notes on the member's erased thread roots, are cleared (NOOK-053). Web Push routing records are removed with the member they belong to and with the message, outcome or member that caused them (NOOK-015, NOOK-073, NOOK-124); none is a structural tombstone. Separate credential-free structural tombstones preserve threads, counters, fixed DM audiences and immutable import ownership; D1 atomically records public Base erasure fences and durable blob obligations before R2 deletion. Completion requires verified blob absence, including resolution of uncertain puts; larger work remains pending with bounded continuation. Latest archives carry the journal and restore normally. Old archives are refused by nonempty-destination guards or the latest journal; a virgin destination without a later journal cannot recognize them. External archives, offline copies, provider backups/Time Travel and physical remnants remain outside logical erasure.

**Acceptance.**
1. Through Team and message erasure doors, preview counts, confirm and resume a pending job.
2. Try an unrelated DM, an insufficient role, self and last owner; deny each.
3. Remove native/imported content and verified R2 bytes, preserve only declared structural tombstones, anonymize audit, and refuse an older archive when the latest erasure journal is supplied.

#### NOOK-015 — Web Push (C15)

**Requirement.** Web Push is a separate, member-enabled channel to their registered browser devices, independent of email. With browser permission granted, DMs, mentions, keyword hits, call invites and followed-thread replies alert without a settings visit; urgent-through-quiet starts off. Conversation levels, mute, quiet, read/done, current access and source availability govern routing. Each installation sends directly to supported browser vendors with encrypted payloads and its own protected key; NOOK-062 governs richer previews. Devices are session-bound, owner-private and limited to ten per person. Duplicates and overlapping reasons produce one alert per device; gathering and folding are independent of email. Interrupted sends stay uncertain, and confirmed devices are not repeated during another device retry. Body-free routing history survives archives without keys, devices, presence or queues, and restore sends nothing old. Member and source erasure clear affected devices and routing. The installable PWA caches no private content; foreground refresh clears stale notices and badges, while a sleeping device may retain a displayed notice. Every push is visible, with authenticated taps; no silent clear-only push is sent. NOOK-073 governs active-elsewhere holds. [Web Push protocol](docs/contract/mechanism.md#nook-015) defines registration, encryption and supported hosts.

**Acceptance.**
1. Register a subscription, choose notification preferences and observe delivery through the Worker and its alarm; independently decrypt the RFC 8291 packet and verify VAPID, revocation, quiet/read cancellation, per-device folding and visible failure.
2. Separately demonstrate foreground/background/locked-device visible notification, tap authentication and badge reconciliation on supported Safari, Chromium and Firefox devices.
3. Defaults: a newly invited member grants browser permission in a fresh profile without opening settings, and a DM, a mention and a keyword hit each show exactly one notification; a channel set to `all new messages` notifies on a colleague's plain message and a channel left at `mentions` does not.
4. Defaults include automatic follows: a reply in a thread the member started in a `mentions` channel shows one notification without any explicit follow.
5. Cross-device routing: with the member's Chrome page focused and in use, a DM shows on that page and no Web Push reaches their phone's installed PWA; after the page is idle 10 minutes the phone notifies (NOOK-073).


## Target clauses


### Complete workplace messaging target

#### NOOK-016 — Everyday conversations

*Tier:* Core · *Rules:* D-1

**Requirement.** People create discoverable team channels, private channels, one-to-one and fixed-participant group DMs; send messages, open replies in a root thread, add/remove emoji reactions and edit/delete their own messages. A durable link opens the intended conversation/thread under current membership. Channel browsing and idempotent join never reveal private conversations; guests cannot browse or join outside their grant. Members leave any channel they belong to themselves, from every client and the API, except an organization-wide default channel an owner has made mandatory. Leaving removes the channel from navigation, unread and notifications and keeps the member's messages; returning to a private channel needs a manager to add them again, and the last manager of a private channel must transfer management before leaving.

**Acceptance.**
1. Use two signed-in people at 1440 and 390 to create/join a channel, exchange roots/replies/reactions, open a thread link after reload and edit/delete a message.
2. An outsider and a guest fail to discover private content or expand access.
3. A member leaves a public and a private channel: each disappears from navigation, unread and notifications; they rejoin the public one, are refused rejoining the private one without a manager, and are refused leaving the mandatory default channel.

#### NOOK-017 — Composition and typed markup

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** The composer supports accessible rich text, lists, code blocks, safe links, emoji, explicit person/channel mentions and ordered attachments, with consistent plain-text export. Length and typed markup: a message holds up to 40,000 characters, Slack's limit. The composer shows the remaining count from 36,000, and pasting or typing beyond the limit offers to post the text as a snippet (a NOOK-061 text attachment with an inline preview) or to split it, never truncating silently. Every write door (send, edit, API, and NOOK-112's `chat.postMessage`, which answers Slack's `msg_too_long`) refuses over-length text with `message_too_long` and writes nothing. As typed, `*bold*`, `_italic_`, `~strike~`, `` `code` ``, triple-backtick blocks, `>` quotes and `- `/`1. ` list starts convert to formatting; one undo restores the literal characters, and each member can turn the conversion off.

**Acceptance.**
1. Compose formatted text/code and an attachment, deliberately interrupt a send and reconcile it once. Private draft resumption is NOOK-135.
2. Paste 50,000 characters: the composer offers a snippet or a split, and posting as a snippet yields one message with a previewable text attachment; an API post of 40,001 characters is refused with `message_too_long`, and one of 40,000 posts whole.
3. Type `*bold*`, `_italic_`, `~strike~`, `` `code` ``, a fenced block, `> quote` and `- item`: each converts as typed, one undo restores the literal text, and the plain-text export keeps the content.

#### NOOK-090 — Personal profile, status and presence

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** People set their profile, time zone, presence and a custom status (emoji and text) with Clear after: never, 30 minutes, 1 hour, 4 hours, today, this week or a chosen date and time in their time zone, clearing at that moment on every client. Typing and presence are advisory and may be disabled.

**Acceptance.**
1. Change status and time zone without changing work acceptance.
2. Set a status to clear after 30 minutes and see it disappear on another client at that time, across a restart.

#### NOOK-091 — Built-in conversation commands

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** Built-in commands: typing `/` lists built-in commands, with arguments and a description, before NOOK-025 app commands, and no app may register a built-in name. Each runs through the same API, permission check, audit and confirmation as its menu action: `/remind` (NOOK-033), `/invite @person [#channel]` (NOOK-016 and NOOK-018, under channel-manager and NOOK-060 policy), `/leave` and `/who` (NOOK-016), `/topic` and `/rename` (NOOK-060), `/mute` (NOOK-032), `/dnd [duration or time]` (pause notifications until then, NOOK-032), `/status [emoji] [text]`, `/away` and `/active` (NOOK-090), `/msg` and `/dm @person [text]` (open or send a DM), `/huddle` (NOOK-022), `/gif [words]` (NOOK-116), `/shrug [text]` (appends `¯\_(ツ)_/¯`), and `/collapse` and `/expand` (hide or show every inline preview in the conversation for that member). A command the member lacks permission for answers privately with the reason and changes nothing; an unknown command posts nothing and offers to send the text as a message. The NOOK-052 shortcut sheet lists the built-in commands.

**Acceptance.**
1. Type `/` and see the built-in commands before app commands.
2. Run `/remind me tomorrow at 3pm to send the deck`, `/invite @ana #sales`, `/topic Q4 launch`, `/rename #sales-us`, `/mute`, `/dnd 1 hour`, `/status :palm_tree: Out until Monday`, `/msg @ana hi`, `/huddle`, `/gif thumbs up`, `/shrug ok`, `/collapse` and `/leave`: each has the same effect, permission check and audit as its menu action. `/rename` by a member without rename permission is refused privately with the reason, and `/wat` posts nothing and offers to send it as text.

#### NOOK-092 — Drafts and sent messages view

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** Drafts & sent: one view lists the member's unsent drafts across conversations, their NOOK-034 scheduled messages and the messages they sent in the last 30 days, each opening in its conversation; editing or canceling a scheduled message there changes it under NOOK-034.

**Acceptance.**
1. Open Drafts & sent and find an unsent draft from another channel, a scheduled message, change its time there, and yesterday’s sent message.

#### NOOK-018 — Invitation and offboarding journeys

*Tier:* Core · *From:* NOOK-018 · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** An owner bootstraps the installation and owner/admin/member roles govern team administration. People join through exactly four doors, each ending in a confirmed mailbox: a one-use email invitation, an owner-controlled invitation link, approved-domain self-join, or SSO just-in-time sign-in (NOOK-037); an address that arrives through none of them cannot register. Every invitation and join-confirmation email carries a one-time code, an open-in-app link and a QR code for the native apps (NOOK-074). NOOK-075 external participants are not members: they enter only by invitation to a shared conversation and never through these doors. Team access grants distinguish members from channel-scoped guests. Channel membership and fixed DM audiences remain independent of administrative roles. Deactivation revokes every session and private read; reactivation never revives old sessions or silently regrants private conversations.

**Acceptance.**
1. Invite a member and scoped guest via Team, confirm once, browse/join as each and refuse guest expansion or owner DM snooping.
2. Deactivate a person signed in twice, reactivate, and prove both old sessions remain invalid and explicit regrant is required.

#### NOOK-093 — Bulk team invitations

*Tier:* Core · *From:* NOOK-018 · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Bulk invitations: an inviter permitted under NOOK-060 pastes many addresses or uploads a CSV of email, name, role (member or guest) and channels, with an optional expiry for guests, up to 1,000 rows per batch. Before anything is sent, a preview flags existing accounts, already-pending invitations, duplicates within the batch, invalid addresses and addresses refused by domain policy; one action then sends one invitation per remaining address. Pending invitations can be resent or revoked and expire after 30 days by default, and each accepted invitation lands the person in the NOOK-060 default channels plus any channels named for them.

**Acceptance.**
1. Bulk, link and domain doors: paste 50 addresses including one duplicate and one invalid; the preview flags both, 48 invitations are sent, and each person who accepts lands in the default channels.

#### NOOK-094 — Invitation links and requests

*Tier:* Core · *From:* NOOK-018 · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Invitation link: owners, or admins delegated under NOOK-060, create a shareable link with an expiry (up to 30 days) and a use limit (up to 400 uses, Slack's bar). Each use still confirms the joiner's mailbox, creates a member (never a guest or admin) in the default channels, and is audited under NOOK-051 with the link ID. A use past the limit or expiry is refused, revoking a link stops further joins immediately, owners can disable links for the workspace, and links are disabled while SSO is enforced. Invitation requests: where members may not invite, a member may request an invitation for an address, which an authorized inviter approves or declines.

**Acceptance.**
1. Create a 7-day invitation link limited to 10 uses: the 11th use is refused, revoking the link stops further joins, and each use appears in the audit log.
2. With member invitations restricted to admins, a member's invitation request reaches an admin, who approves it, and the invitee joins.

#### NOOK-095 — Verified-domain joining

*Tier:* Core · *From:* NOOK-018 · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Approved-domain join: owners approve email domains verified by a DNS TXT record; consumer webmail domains such as gmail.com cannot be approved. Anyone who confirms a mailbox at an approved domain joins as a member, never a guest or admin, into the default channels and under NOOK-069 second-factor policy; while SSO is enforced, domain joins go through the IdP. Owners can switch a domain off without affecting existing members.

**Acceptance.**
1. Approve a verified `example.com`: a new `@example.com` person joins as a member with 2FA enforced, while an `@other.com` address and an attempt to approve `gmail.com` are refused.

#### NOOK-019 — Search conversations and files

*Tier:* Core · *Rules:* D-1

**Requirement.** Search native and imported messages, thread replies, authorized file names and extracted text with channel, person, date range, conversation type and has-file filters. Matching combines word/token search for terms of any length (one- and two-character terms such as "Q3", "HR", "PO", "AI", "5k" and single letters or digits included) with exact phrases, prefix and case-insensitive substring search, Unicode-aware tokenization and readable query errors; no term is refused for its length. Results identify source, timestamp, author and excerpt, open surrounding context, and page completely. Index, previews, snippets and counts recheck current membership and deletion/retention; unsupported or unindexed files are named rather than represented as searched. Typed modifiers: Slack's search modifiers parse into the same filters, shown as removable chips: `from:@person` and `from:me`, `in:#channel` and `in:@person`, `with:@person`, `to:me`, `has:link`, `has:file`, `has:pin`, `has::emoji:` (a reaction), `is:thread`, `is:saved`, `before:`, `after:` and `on:` with a date, `during:` with a month or year (for example `during:september`, in the searcher's time zone), quoted exact phrases and `-word` exclusion; an unrecognized `word:` is searched as text with a hint listing the supported modifiers. Files views: every conversation has a Files tab listing its native and imported files newest first, filterable by type and person, and a workspace Files view lists every file the member can read; both recheck current membership, deletion and retention like search.

**Acceptance.**
1. Find an old imported reply and a phrase inside a permitted PDF/text attachment using author/date/channel filters; open context from each client.
2. Search "Q3" and "HR" with a channel and date filter and get every authorized message and file containing those tokens.
3. Page an 80,000-message corpus completely with no duplicate or missing result; remove membership/delete a file and confirm its snippets, counts and cached results disappear.
4. Type `from:@jane in:#sales has:link before:2026-10-01` and get the same results as the equivalent filters, shown as chips; `during:september` returns September messages in the searcher's time zone, and `-draft` excludes matching messages.
5. Open a private channel's Files tab and see its native and imported files; a non-member sees neither the tab nor those files in the workspace Files view.

#### NOOK-020 — Saved items and channel pins

*Tier:* Core · *Rules:* D-1

**Requirement.** People save messages, files and links privately for later, optionally attach a due reminder, and retrieve an ordered personal list. Authorized members pin/unpin shared context in a channel with visible actor and time. Saves and pins preserve contextual links, honor current ACL and tombstone unavailable sources without copying erased bodies.

**Acceptance.**
1. Save a DM and pin a channel message, retrieve both after restart on another device, then remove membership and erase the source.
2. Private saves stay private and every unavailable item loses its excerpt.

#### NOOK-021 — Signed native clients and offline catch-up

*Tier:* Core · *From:* NOOK-021 · *Rules:* D-1 · *Register:* R-1

**Requirement.** Ship signed iOS and Android apps and macOS, Windows and Linux desktop apps, alongside the web/PWA, with authenticated deep links, multi-workspace isolation, keyboard/screen-reader access, update/recovery paths and explicit supported OS versions. A device's first sign-in, the open-in-app links and QR codes that point it at this installation, and the MSI/MSIX, PKG, Linux and MDM-configured packages IT uses to deploy it are NOOK-074, NOOK-125. APNs and FCM power native notifications, badges and call invitations, reached from every customer installation through NOOK-078's push path (the publisher-operated Nook Push Gateway, or the owner's own credentials with self-built apps), with per-device preferences, the message-text previews, org caps and Reply/Mark-as-read actions defined in NOOK-062, NOOK-111. An OS share-sheet/share-target extension on iOS, Android and desktop shares photos, files, links and text from other apps into a chosen conversation or thread with an optional note, under current membership, NOOK-061 file policy and NOOK-066 posting permission. Encrypt authorized offline caches, make cached age/offline state visible, queue drafts/sends with intent identity, and reconcile history, edits, deletions, read state and revoked scope on reconnect. Logout clears local private data; an offline device cannot learn revocation until reconnect, and admins can disable offline retention. Show OS permission, registration, provider acknowledgment and observed device receipt distinctly; repair stale subscriptions without duplicate sends. Supported OS floor: the current and previous major releases of iOS/iPadOS and Android (Android with Google Play services for FCM), macOS, Windows 11, and the current and previous Ubuntu LTS, published in `/docs` and on the download page and re-stated each release; an install or sign-in below the floor shows an explicit unsupported notice instead of silently degraded alerts.

**Acceptance.**
1. Install release-built apps on supported iOS/Android simulators and each desktop OS fixture and sign each in through a NOOK-074 path, never a pre-seeded session.
2. Read on another device, disconnect/reconnect, race a send retry and revoke membership: converge once, purge revoked caches and verify logout isolation.
3. Share a photo and a PDF from the iOS and Android share sheets into a private channel thread and see each post once.
4. A device below the published OS floor shows the unsupported notice; the native draft, status, notes, workspace and posting journeys use the same product rules as their web counterparts.

#### NOOK-096 — Native alert defaults and device convergence

*Tier:* Core · *From:* NOOK-021 · *Rules:* D-1 · *Register:* R-2

**Requirement.** Default alerts: first sign-in on a device asks for OS notification permission, saying what will alert; once granted, and without opening settings, a new member's device alerts on DMs and group DMs, mentions (including NOOK-065 broadcast mentions), keyword hits, call invites and replies in followed threads (including NOOK-072 automatic follows), matching Slack's defaults; which of the member's devices alerts while they are active on a desktop is NOOK-073. Per-conversation `all new messages`/`mentions`/`nothing` levels and their mobile override come from NOOK-032, NOOK-100, organization defaults from NOOK-060, and settings show plainly when the OS has denied permission. Native clients inherit the thread-follow and active-elsewhere device facts of NOOK-072 and NOOK-073, including OS lock and sleep activity, per-device routing choices and durable held/released/canceled records.

**Acceptance.**
1. In foreground, background, force-closed and locked states send a mention/DM/call invite, observe alert/badge and tap to context; disable permission and expose the reason.
2. Default alerts: a freshly invited member installs the iOS app and allows notifications without opening settings; a DM, a mention and a keyword hit each alert once; repeat on Android and on one desktop OS.
3. Automatic follows alert without an explicit follow; active desktop use holds mobile alerts until inactivity or lock, unless read first. Badges converge within ten seconds of reconnect, foreground or another device read.

#### NOOK-097 — Native delivery measurement

*Tier:* Core · *From:* NOOK-021 · *Rules:* D-1 · *Register:* R-2

**Requirement.** Delivery bar, measured and published: for events eligible to alert after NOOK-032 schedules, NOOK-062 previews and NOOK-065 broadcast policy (mentions, DMs, keyword hits, broadcast mentions, call invites) to a device reachable by APNs or FCM (or a running/at-login desktop app) and routed to that device by NOOK-073, NOOK-124, at least 99.5% are displayed; the bar is measured against that routed device set, and a release after a NOOK-073, NOOK-124 hold is timed from the release; commit-to-display is p95 ≤ 5 s and p99 ≤ 30 s; a call invite rings a locked phone (CallKit/PushKit on iOS, a full-screen call notification on Android) within 5 s at p95; and every device's badge equals the authoritative unread plus Attention count (followed-thread replies included unless the member chose NOOK-072, NOOK-123's mentions-only thread badge) within 10 s of reconnect, foreground or a read on another device. Every eligible event not displayed is recorded under NOOK-008's distinct facts as `provider-unconfirmed` (the NOOK-078 gateway, APNs or FCM did not accept or acknowledge it) or `device-unobserved` (accepted, but no display receipt from the device within 60 s), shown in the member's device delivery view and the owner's delivery report (NOOK-048); none goes missing silently. A mobile alert held because the member was active on desktop and then canceled by a read or done is recorded as `held-active-elsewhere`, counted neither as displayed nor as a miss. The delivery bar is an obligation of every customer installation on its own Cloudflare account, never met only by a publisher-operated installation. It also inherits the native halves of NOOK-135, NOOK-090, NOOK-137 (draft, status and workspace-switch journeys), NOOK-053 (conversation notes and checklists with history, revert, pins, saved links, proposals and the erased-member display), NOOK-065 (broadcast delivery), NOOK-066 (native writes under the posting fence), NOOK-072, NOOK-123 (thread-follow alerts, mentions-only badges and device receipt) and NOOK-073, NOOK-124 (the signed, session-bound `{id, page, visible, lastInputAt, locked}` heartbeat from every native app, inactivity one minute after an OS lock or sleep, macOS, Windows and Linux desktop-app routing, the per-device "Always send to mobile, even when I'm active" choice on each native device, and native held, released and canceled routing records retained with their reasons, restored, exported and erased as on the web).

**Acceptance.**
1. On declared CI hardware, run a seeded 500-event device-protocol fixture across foreground, background, force-closed and locked states, with mentions, DMs, keyword hits, broadcast mentions and call invites and the published supported-OS fixtures.
2. Measure the routed event set against the same bar: at least 99.5% displayed, commit-to-display p95 at most five seconds and p99 at most thirty seconds, locked-call ring p95 at most five seconds, and badge convergence within ten seconds of reconnect. Publish the fixture measurements beside the separate real-device register receipt.
3. Every missing display has its provider-unconfirmed or device-unobserved outcome in the member and owner reports; a silent miss fails. Held-active-elsewhere events canceled by a read are neither displayed nor missed; released events are timed from release. A below-floor fixture reports unsupported, and every customer installation uses the named push path.

#### NOOK-022 — In-context voice, video and screen sharing

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** Start a one-click audio/video huddle in any authorized channel or DM, discover/join the ongoing call, invite current participants and move between supported clients. Support device selection, mute, camera, screen/window sharing, participant roster, hand raise, captions, keyboard controls, reconnect and explicit end/leave. Supported size: up to 50 participants per huddle with up to 25 cameras on at once (Slack's paid bar), several simultaneous screen shares and grid/speaker layouts that adapt at 390 width; above the limit a joiner sees an honest "This huddle is full (50 of 50)" state with an option to be told when space opens, never a silent degraded join. Use integrated media infrastructure such as LiveKit Cloud or Twilio with scoped short-lived tokens, disclosed media processing and TURN relay operation. Joining, guest entry, screen content and call artifacts follow current conversation/org policy; revocation terminates admission. Recording/transcription is off until participants receive notice and policy-required consent; NOOK-024 governs artifacts. `/huddle` (NOOK-091) starts or joins a call through this clause. A call invite rings or alerts every one of the invitee's devices regardless of NOOK-073 activity routing; no phone is held because the invitee is active on desktop.

**Acceptance.**
1. From a private channel and DM run a three-person real audio/video call across desktop and phone, share a window, read captions, switch devices, interrupt networking and reconnect.
2. Remove a participant and deny further media access; an outsider cannot join with a copied link.
3. Refused microphone/camera permission and failed relay show actionable states.
4. At 50 participants with 25 cameras on across desktops and phones, measure p95 join time ≤ 3 s, audio continuity (no gap over 500 ms in a 10-minute session on the target network) and screen-share legibility (10-pt text readable at 390 width); a 51st joiner sees the full state.
5. With the invitee active on a desktop app or focused web client, an invite still rings their phone.

#### NOOK-023 — Zoom, Google Meet and Teams meetings

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** Connect Zoom, Google Workspace/Meet and Microsoft 365/Teams with least-privilege OAuth. Create or attach a provider meeting from a conversation/calendar event, render who hosts it and its time zone, and launch/join from every client. Provider authentication and admission still govern the call. Changed/canceled events update their card; missing scopes, revoked grants and failed meeting creation are visible without posting a broken success link. Recording links inherit both provider and Nook permissions.

**Acceptance.**
1. For each named provider connect a provider sandbox or official-schema fake, create and join from a channel and DM on phone/desktop, reschedule then cancel, and revoke consent.
2. Observe provider-confirmed links and honest failure; a private recording link never broadens provider access.

#### NOOK-024 — Asynchronous clips, transcripts and call artifacts

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-006

**Requirement.** Record or upload audio, video and screen clips from the browser on phone and desktop. Recording starts only on an explicit action with a visible indicator, never secretly. A clip is a private scoped file under its source message's audience, with playback controls, seek, an accessible transcript, captions from an uploaded WebVTT track or timestamped cues the member types, stated supported limits, and a visible upload or processing failure with retry. Members correct transcript text with history. Retention, export, hold and erasure follow NOOK-038/NOOK-047/OPS inheritance, and deleting a source invokes them.

**Acceptance.**
1. Record a clip on a phone and a desktop viewport (browser fake media device), play it, seek from transcript cues, add and correct a transcript with history; an outsider is refused; simulate a failed upload and see retry; export, delete and hold without losing policy state.
2. Start audio, camera or selected-screen capture by explicit action; stop and cancel visibly, or upload supported media.
3. Typed cues and uploaded WebVTT append immutable transcript versions; correction compares the opened version and preserves a concurrent editor.
4. Erase source-owned clips and transcript versions; anonymize an erased correcting member while retaining another author’s text. Export and restore private bytes, all versions and source policy.

#### NOOK-025 — App platform and scoped event delivery

*Tier:* Core · *From:* NOOK-025 · *Cites:* BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** Owners install/revoke scoped apps with visible publisher, permissions and egress. Provide versioned REST/events APIs, incoming and outgoing signed webhooks, slash commands, interactive message buttons/forms and bot identities; the Slack-compatible webhook, Web API, Events API, slash-command and Block Kit surface with its published compatibility matrix is NOOK-063, NOOK-112, NOOK-114, NOOK-113, Zapier/Make/n8n connectors are NOOK-064 and app link unfurls are NOOK-068. Event cursors, signatures, replay protection, idempotency, rate limits, subscription filters and delivery/failure logs are public contracts. Bots do not impersonate people or gain private conversation membership without a grant. An accountable agent's own commitment action carries commitment under the company's policy, with truthful attribution.

**Acceptance.**
1. Install an app as owner, subscribe only one channel, post a signed incoming event, invoke a slash command and click an interactive approval.
2. Replay/forge payloads, exceed a rate limit, copy a private event ID and revoke the app: deny escalation, avoid duplicate effects and show delivery/uncertainty.

#### NOOK-098 — App direct messages and home

*Tier:* Core · *From:* NOOK-025 · *Cites:* BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-008, BASE-SECRET-001 · *Rules:* D-1

**Requirement.** App DMs and app home: an app whose install-time permission screen lists the `im:write`-style scope may open exactly one app DM per person and app (NOOK-112 `conversations.open`), labeled with the app identity, publisher and an App badge, holding only that app's messages and the person's replies; app-DM permission follows the organization's app policy; an accountable agent's access and external calls follow the company's risk policy. The person can mute the app DM, leave it (hiding it until the app next posts) or block the app, after which opens and posts are refused and nothing is delivered until they unblock; every app DM and its scopes are listed in the person's Apps settings. An optional app home (`views.publish`) shows app-supplied blocks to that person only. An app's token reads only its own app DMs and conversations it is a member of; it never reads or lists another DM, group DM or private channel. A person grants an app a private channel only by adding it as a member (`/invite @app` or channel details), which members see and NOOK-051 audits; removing it revokes access immediately.

**Acceptance.**
1. An app with the DM scope opens one app DM with a member; the member mutes, blocks and unblocks it, and posts are refused while blocked.
2. The member adds the app to a private channel and removes it, and the audit log shows both; the app's token cannot list or read any other DM, group DM or private channel.

#### NOOK-099 — App channel management

*Tier:* Core · *From:* NOOK-025 · *Cites:* BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** Channel management: creating, inviting into, renaming, setting topic/purpose and archiving channels requires the app's install-time channel-management scope, follows the org's channel-creation policy (NOOK-060), invites only people the org permits, and every use is audited with the app identity and the installing person. Outgoing actions bind actor, conversation, destination and consent; rotated/revoked grants stop new work and untrusted links cannot cause arbitrary fetch/SSRF. Apps inherit NOOK-066's posting fence and NOOK-065's broadcast policy atomically as membership (a refused write commits nothing), and no app may register a built-in command name or reorder built-ins (NOOK-091).

**Acceptance.**
1. An app without the channel-management scope cannot create a channel.

#### NOOK-026 — Workflow builder and durable scheduled work

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004, BASE-AGENT-007 · *Rules:* D-1

**Requirement.** Non-developers build versioned workflows triggered by schedules, forms, messages, an emoji reaction added to a message, a member joining a channel, webhooks and accepted commitments, with conditions and scoped steps for messages, requests, member pairing and connector actions. Templates ship for a welcome DM when someone joins a channel, an action on a chosen reaction (for example :ticket: opens a request), recurring stand-ups and intro pairing (members of a channel paired at random on a set cadence and sent a prompt by DM). Preview audience/data/actions, test with disclosed effects, publish as an accountable owner and choose approvers. Every run records trigger, input references, revision, owner, due time, steps, approval, retries, outcome and stop condition; wait states survive restart. Pause/cancel prevents future work, approval expiry stops writes and dead/uncertain external effects stay visible without blind replay. Editing a workflow never rewrites an in-flight agreement. Every workflow post inherits NOOK-066's posting fence and NOOK-065's broadcast policy at run time; a refused post commits nothing and shows as a failed step.

**Acceptance.**
1. Build a recurring stand-up form that posts a channel summary and proposes work only for explicit acceptance.
2. Publish, trigger once, pause during an approval wait and restart; no duplicate post or unauthorized write occurs.
3. Refuse a revoked connector and expose the failed step plus a safe human resume choice.
4. A welcome workflow DMs a person exactly once when they join `#onboarding`; adding :ticket: to a message runs the reaction workflow once for that message even when two people add it; intro pairing over a 9-member channel produces four pairs and one trio with no one left out.

#### NOOK-027 — Engineering and project integrations

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** First-party GitHub, Jira, Asana, Linear, Trello, ClickUp, monday.com and Vector connectors post selected issue/PR/review/build/deployment/project changes to chosen channels with source links and deduplicated provenance. Authorized slash commands/cards can inspect, propose or create linked issues/tasks and request review, then refresh status through completion/reopen. Each external write previews its exact effect and uses the acting user's scoped grant; an agent's call carries external, and commitment where it binds the business, under the company's policy. Failure and revocation are visible. Vector remains the project-work product; Nook owns the conversation and accepted commitment, not a duplicate tracker or roadmap.

**Acceptance.**
1. Connect each named service, route a selected project/repository event, act from a card and follow a linked issue/PR from open to complete to reopened.
2. Retry its webhook, remove source permission and revoke the grant: exactly one authorized effect and no leaked project context.
3. Vector remains the authoritative work record.

#### NOOK-028 — Support, sales and operational signals

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** First-party HappyToHelp, Zendesk, Salesforce and HubSpot connections bring authorized ticket/account/contact/deal context into scoped conversations and send replies/notes whose external class the company's policy decides for agents or create linked work through scoped grants. Uptime, Lamp, PagerDuty and Opsgenie integrations route incident, on-call page, recovery and alert signals with source severity, acknowledgment state and stable links, thread follow-up updates, deduplicate repeats and expose delivery failures. Users choose routes, urgency, quiet-time behavior and pause. HappyToHelp owns support cases, Uptime/Lamp/PagerDuty/Opsgenie own their incident/alert/on-call state, and Salesforce/HubSpot own CRM records; a Nook read/reaction never claims customer reply, incident resolution or human response.

**Acceptance.**
1. For each named service route a real sandbox case/account/alert event, inspect an authorized preview, approve a supported write and observe source-confirmed state.
2. Deliver duplicate/recovery events, disconnect the source and remove channel access; keep one linked thread, no false completion and a visible failed/uncertain action.

#### NOOK-029 — Connected documents and knowledge

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** Google Drive, Microsoft 365/OneDrive/SharePoint, Notion, Dropbox and Box connections, plus Loom video and Figma design links, provide permission-aware link cards, document/file picking, comment/update signals and authorized retrieval for search/agents. Source ACL and current Nook audience intersect; private metadata/previews never leak through a shared link. Expired links or revoked grants lose previews and derived access. File storage, collaborative authoring and long-lived knowledge remain in their source product or the separate Chest product; Nook does not become that document repository. No automatic remote fetching occurs without explicit connector policy. Links saved in conversation notes (NOOK-053) connect the same way: permission-aware cards, picking and retrieval under source ACL and the current audience, and loss of preview and derived access on revocation; until a connector exists they stay plain links labeled “link, not synced”.

**Acceptance.**
1. Connect each named provider, share an authorized document into a matching channel, retrieve its card/text as an allowed member and refuse a source-denied member.
2. Revoke provider sharing or disconnect, refresh search/agent context and show unavailability without cached excerpts or broadened access.
3. Save a Google Drive link in a channel note: an allowed member sees its card, a source-denied member sees only the plain link, and revoking sharing removes the card.

#### NOOK-030 — Calendars, availability and meeting reminders

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** Google Calendar and Microsoft Outlook/Exchange Online calendars show scoped event cards, local time zones, reminders, free/busy and optional meeting status. With an explicit grant, users create/update events and attach Meet/Zoom/Teams links from a conversation, invite chosen people and receive change/cancellation notices. Private event titles and attendee details remain hidden where only availability is authorized. Members may turn on calendar-driven status: during a busy event their status becomes "In a meeting" ("Out of office" for an all-day out-of-office event) with the event's end as its expiry, set and cleared from the calendar without revealing the event title, and never overwriting a status the member set by hand. Quiet time and deduplication apply, and revoked access stops polling, sync and writes.

**Acceptance.**
1. Connect both calendars, create a cross-time-zone meeting from a DM, accept/change/cancel it at the provider and see exactly one current card/reminder.
2. Show free/busy without private title access, cross a daylight-saving transition and revoke the grant before a scheduled action.
3. Turn on calendar-driven status: a private meeting sets "In a meeting" without its title and clears at its end, and a hand-set status is left untouched.

#### NOOK-031 — Shared channels between organizations

*Tier:* Core · *Rules:* D-1

**Requirement.** Separate organizations explicitly invite and mutually approve a shared channel with named org admins and an external-people indicator. Each org independently grants its people, apps, guests, export, retention and media permissions; the effective cross-org data/action policy is shown before connection. No shared channel reveals either parent directory, internal channels or DMs. A member may also start a DM or group DM with an individual at another organization when both organizations' policies allow it and the recipient accepts the invitation; external DMs carry the same external indicator, per-org retention/export/media policy and either-side block or disconnect. Scope changes require authorized approval; either org can disconnect, stopping new access and app delivery while retained copies/holds and each org’s erasure duties are disclosed and auditable. A person whose organization runs no Nook installation joins a shared channel or external DM as a NOOK-075 external participant, and Slack Connect conversations move at cutover under NOOK-076. Shared channels inherit NOOK-066's posting fence and NOOK-072's automatic thread follows.

**Acceptance.**
1. Two independently administered organizations approve a channel, exchange messages/files/calls and install one narrowly scoped bot; start and accept an external DM, then block it through one organization's policy.
2. Exercise a single-channel guest, denied directory lookup, conflicting retention/export policy, member removal and full org disconnect.
3. Every client/search/agent/API loses revoked access while permitted historical copies are explicitly accounted for.
4. Inherited from NOOK-080: sharing a channel that has an approved notification app changes its audience sharing fact, and later app posts, edits and deletes write nothing.

#### NOOK-032 — Quiet schedules and personal keyword routing

*Tier:* Core · *From:* NOOK-032 · *Rules:* D-1

**Requirement.** Extend per-conversation mute/follow and one-off quiet time with recurring working/quiet hours in the recipient’s time zone, weekday exceptions, vacation and device-specific rules; when the member's phones and tablets alert relative to desktop activity is NOOK-073, NOOK-124. Members choose mentions, DMs, followed threads, digests and whether explicit urgent requests may bypass quiet time. Activity feed, badges and external channels reconcile read/done status without turning a mention into an obligation. Members define personal keywords (words or phrases, case-insensitive, token-matched like NOOK-019) that create a `keyword` Attention reason with its own push/email choice, only in conversations they can currently read, never for their own messages and not in muted conversations unless chosen. Explain why each item was delivered, held or suppressed and allow a bounded snooze; DST and travel do not silently shift the declared schedule. Web quiet schedules keep seven weekday rules in the recipient’s explicitly chosen IANA time zone, initially using their profile zone. An overnight rule belongs to the day it starts; disabling Friday leaves Thursday night’s Friday morning intact. Each boundary is resolved from its local calendar date: overlaps use the earlier occurrence and missing local times advance by the transition gap. The stored wall-clock times and zone stay unchanged through DST and travel; time-zone changes are explicit. Email and Web Push hold and release through the existing durable queue, recheck current access and notification choices, and retain the existing opt-in urgent bypass. Quiet and item snoozes are bounded to seven days. Attention and the recipient-only delivery view explain delivery, quiet holds, level suppression and active-elsewhere holds; provider acceptance does not claim observed device display. Web Push quiet-schedule and quiet-snooze holds, and their releases, are retained with their hold reasons as NOOK-073, NOOK-124 routing records; email entries follow NOOK-014. The schedule survives archive restore, with derived boundaries recomputed, and follows member erasure.

**Acceptance.**
1. Set a weekday quiet schedule and channel override, cross midnight/DST and restart without a page open.
2. Send routine/mention/urgent events and a message containing the recipient's keyword "invoice" from another account (one keyword item in a readable channel, none in a muted or unreadable one), read on a second device and compare the activity feed, held items, badges and provider attempts with the recipient’s stated rules.
3. During quiet time the `#incidents` alerts are held and released by the schedule.

#### NOOK-100 — Per-conversation notification levels

*Tier:* Core · *From:* NOOK-032 · *Rules:* D-1

**Requirement.** Per-conversation notification level: each member sets any channel, private channel, shared channel or group DM to `all new messages`, `mentions` or `nothing`, with an optional different level for mobile devices (phones and tablets) than for desktop and web. `mentions` is the default for channels; one-to-one and group DMs default to `all new messages`. `all new messages` creates a routine `all-messages` Attention reason and alerts the chosen device class on each new root message and each thread reply also sent to the channel (NOOK-117), under the member's quiet schedule, NOOK-097's delivery bar, NOOK-062 previews and the NOOK-014/NOOK-015 gathering and ten-minute folding rules; the member's own and imported messages never alert. `mentions` alerts only on explicit mentions, NOOK-065 broadcast mentions, keyword hits, urgent requests and followed-thread replies (including NOOK-072, NOOK-122 automatic follows). Alongside the level, a member may set all thread replies for the conversation (NOOK-122), so every thread in it counts as followed for them, with its own mobile override. `nothing` sends no device or email alert for that conversation, including `@channel`, `@here`, `@everyone` and explicit mentions, consistent with NOOK-065's ignore choice; explicit mentions and urgent requests still appear silently in Attention. `all new messages` and NOOK-013 mute are exclusive: choosing one clears the other. A settings list shows every conversation whose level differs from the default (per device class), and each row resets to the default in one action. The level is served through the conversation notification settings and every client.

**Acceptance.**
1. They set `#incidents` to `all new messages` on mobile only: a colleague's plain message there alerts their phone but not their desktop, while a routine message in a `mentions` channel alerts nothing.
2. Setting `#random` to `nothing` suppresses even an `@here`.
3. The exception list shows `#incidents` and `#random`, and resetting each returns it to `mentions`.
4. with `#incidents` also set to all thread replies on mobile only, a reply in a thread the member never touched alerts their phone (when they are not active on desktop, NOOK-073) and not their desktop, the exception list shows the setting, and resetting it returns `#incidents` to followed threads only.

#### NOOK-101 — New-member notification choices

*Tier:* Core · *From:* NOOK-032

**Requirement.** New-member defaults: push alerts on DMs, mentions, keyword hits, call invites and followed-thread replies, including NOOK-072 automatic follows (NOOK-015, NOOK-021), routed between desktop and mobile by NOOK-073. Email stays off (NOOK-014), and first sign-in onboarding says so plainly, offering one action to turn on "Email me about mentions and DMs when I'm away" bundled every 15 minutes or hourly; owners may make that email choice on by default for new members under NOOK-060. Keyword hits, quiet schedules and previews inherit NOOK-072's thread-follow sentences that name this clause.

**Acceptance.**
1. Per-conversation levels: a freshly invited member allows notifications without opening settings, and a DM, a mention and a keyword hit each alert once.
2. First sign-in tells the member that email is off, and its one-action opt-in produces one 15-minute bundled email for a mention and a DM while away.

#### NOOK-033 — Personal and channel reminders

*Tier:* Core · *Rules:* D-1

**Requirement.** Create a personal reminder from plain text or a message/file, or schedule a channel reminder visible to its intended audience, with due time, time zone, owner and optional recurrence. Edit, snooze, complete and cancel independently of message reads and commitments. Persist due work through restart, recheck audience at firing time and show delivered/held/failed outcomes. A reminder neither assigns accepted work nor automatically reports its completion. Natural-language times: the `/remind` command and the reminder dialog parse Slack's plain-text grammar in the creator's time zone: a target (`me`, `@person` or `#channel`), a time (`in 20 minutes`, `at 3pm`, `tomorrow at 9am`, `on October 20`, `next Tuesday`) or a recurrence (`every weekday at 9am`, `every Monday`, `every month on the 1st`), and quoted or `to …` text. The parsed time and recurrence are shown for confirmation before saving, and a phrase that cannot be parsed is asked again rather than guessed. Reminding another person or a channel follows NOOK-060 policy and the target's current membership.

**Acceptance.**
1. Schedule a personal message reminder and recurring channel reminder, close every client and restart before due.
2. Observe one eligible reminder at the chosen time, snooze/edit/cancel it, revoke the creator’s channel access and confirm no unauthorized later post.
3. `/remind #standup "Post your update" every weekday at 9am` shows its parsed recurrence and posts at 9:00 in the creator's time zone on weekdays only, across a DST change; `/remind me in 20 minutes to call Ana` fires once 20 minutes later; `/remind me sometime soonish` asks again and saves nothing.

#### NOOK-034 — Scheduled and recurring messages

*Tier:* Core · *Rules:* D-1

**Requirement.** Compose a message for later or a recurring channel prompt with previewed audience, attachments, time zone, recurrence, owner and end date. The owner can inspect pending instances, edit/cancel future occurrences and pause the series. A durable scheduler sends once per occurrence under current identity/membership; catch-up policy is explicit after outages and stale prompts need review. Failures, expiry and external uncertainty are visible, never silently skipped or reposted.

**Acceptance.**
1. Schedule a one-off and weekly stand-up, change the time across DST, restart at due time and replay a scheduler claim.
2. See one post per occurrence, then pause/cancel and remove posting access: no new post or hidden failure.

#### NOOK-035 — Channel recaps and catch-up digests

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-DATA-004 · *Rules:* D-1 · *Register:* R-10

**Requirement.** On request, summarize one authorized channel, thread or unread period for the requesting member, with links to messages and files, decisions, accepted obligations and unresolved questions, through NOOK-036's owner-enabled AI door (same off-by-default setting, sealed key, daily cap, fixed passage bound and rejection of tool requests and model prose). A recap shows its range, omissions, freshness and uncertainty; accepted obligations and agreements come only from existing NOOK-004/NOOK-010 records, never from the model's claim, and proposals and reports stay labeled as such. A recipient sees only their current source intersection, including in shared channels, rechecked when the recap is shown. People correct or dismiss a recap without rewriting the source discussion. Organization labels and AI policy recheck inherit NOOK-040. Scheduled digests are NOOK-084.

**Acceptance.**
1. Request a channel and a thread recap over contradictory discussions and a channel the requester cannot read; check every factual point against its source link; remove the requester's access before showing and see the recap refuse; correct a claim and dismiss a recap, leaving source messages unchanged; no private snippet or invented acceptance survives.
2. A recap uses only the current-authorized range, shows omissions, freshness and uncertainty, and never infers a work acceptance from model text.
3. Corrections and dismissals persist privately with attribution and participate in erasure, readable export and archive restore.
4. Organization labels and AI policy recheck inherit NOOK-040.

#### NOOK-036 — AI search with cited answers

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-DATA-004, BASE-SECRET-001 · *Rules:* D-1 · *Register:* R-10

**Requirement.** Ask questions across conversations, files and explicitly connected company context (NOOK-029). Retrieve only current-authorized content, cite exact passages/messages and timestamps, open originals, identify conflicting/stale evidence and say when no support exists. A file or message may contain hostile instructions but cannot grant a tool or change system policy. User feedback/corrections remain separate from source edits; answer caches and embeddings inherit retention, erasure and revocation, and no answer declares completion or agreement. Organization labels and AI policy inherit NOOK-040; settings changes are audited under NOOK-051.

**Acceptance.**
1. Ask an answerable, contradictory and unanswerable question with private files and a hostile document in the corpus.
2. Follow citations, revoke a source and repeat as a different member: deny cross-scope context, abstain where unsupported and perform no embedded instruction or external write.
3. Disclose unsupported or unindexed files and unsearched later pages; abstention names the searched passage boundary.
4. Reject unknown citations, non-exact quotes, tool requests and unsupported prose; only freshly authorized exact quotes appear.
5. Keep conflicting quotes separate with author, date and original links; edits and later replies mark stale evidence.
6. Feedback is separate from source editing, travels through readable export and restore, and disappears with source deletion or author erasure.
7. After restore, AI settings are off and no prior credential or cost counter returns.

#### NOOK-037 — SSO, SAML and lifecycle provisioning

*Tier:* Core · *Cites:* BASE-SIGNIN-001, BASE-ROLE-001 · *Rules:* D-1 · *Register:* R-5

**Requirement.** Map standards-provider groups and identities to Nook roles and channel grants without granting DMs. Preview collisions and external identities; just-in-time admission retains invitation, domain and organization policy. Offboarding ends Nook app/specialist grants and device access while retained work keeps its custody. Support Okta, Microsoft Entra ID and Google Workspace, with verified domains, provider MFA, key rotation and audited owner recovery. Native clients use the system authentication browser with PKCE under NOOK-128.

**Acceptance.**
1. Enforce Nook SSO and rotate provider signing keys while preserving explicit group-to-role and channel mapping, invitation/domain policy and the absence of any DM grant.
2. SCIM-create a group/member, map one channel, suspend/delete and replay the event; every client and grant loses access without deleting preserved evidence.
3. Exercise audited owner recovery without a blanket bypass.

#### NOOK-038 — Retention, legal hold and preservation

*Tier:* Core · *Cites:* BASE-DATA-002, BASE-DATA-006 · *Rules:* D-1

**Requirement.** Authorized admins set workspace/conversation policies for messages, versions, files, clips, conversation notes with their version history, checklist proposals and saved links (NOOK-053), Web Push and native routing records (NOOK-073, NOOK-124; they have no time expiry until such a policy is set) and derived AI data, preview what expires and when, and run/resume durable deletion with failures shown. Authorized custodians place/release a scoped legal hold over people, conversations, date ranges and artifacts with immutable reason/history; it preserves covered revisions and bytes against ordinary edits/deletion/retention. For a covered conversation note it preserves the note and every snapshot, including title, text, checklist items, links, pin and attribution, against note deletion, thread-root erasure, member erasure and retention, while participants see the ordinary NOOK-053 result. User-visible deletion still removes ordinary access, while preserved copies stay in a separate custodian boundary. Hold release re-evaluates pending deletion without restoring messages to chat.

**Acceptance.**
1. Apply a short retention policy, hold a selected member/date range, edit/delete held messages and expire their files.
2. Ordinary participants lose deleted content, a custodian preserves exact history, and an unauthorized admin cannot retrieve it.
3. Release the hold and finish the queued erasure with actual byte verification and audited counts.
4. Notes under hold: hold a channel, then erase its member Ana.
5. A note Ana wrote and Lee revised stays visible to participants with Ana shown as a former member, while the custodian copy keeps every snapshot with its original attribution.
6. A note Ana wrote alone, and Lee's note on a thread Ana started, clear for participants while the custodian copy keeps every snapshot of both; deleting another held note clears it for participants the same way.
7. Ana's erasure receipt names the hold exception and the pending disposition.
8. Releasing the hold completes the pending anonymization and clearing of the preserved copies with audited counts and restores nothing to chat. Preview a retention policy for routing records (NOOK-073, NOOK-124) and see which records would expire.

#### NOOK-039 — Compliance search and controlled exports

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-006 · *Rules:* D-1

**Requirement.** Provide separately granted, audited eDiscovery/compliance search and case exports for authorized public/private/shared conversations, DMs, message revisions, memberships, artifacts and hold state, with filters, approval, purpose, checksum manifest and chain of custody. This explicit exceptional authority is never inferred from owner/admin chat role and never changes ordinary DM access. People can inspect the organization’s export policy; requester, approver and custodian permissions are distinct. Export jobs are cancellable, access-expiring and accounted for; external downloads remain outside Nook erasure. Integrate Microsoft Purview and archive/eDiscovery providers through scoped export, without claiming certification merely from the feature.

**Acceptance.**
1. Open a case, obtain required approval, export a held DM/file plus revision history and verify manifest completeness and hashes.
2. Try the same through an ordinary admin session and deny it.
3. Revoke the custodian mid-job, expire the download and inspect a durable audit of search, approval and retrieval.

#### NOOK-040 — Information protection and data handling

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1

**Requirement.** Admins label sensitive conversations/files, set information-protection rules for sharing, downloads and apps, with block, warn or quarantine outcomes for people. Agent calls compute sensitive and external from those labels and audiences; the company's policy decides those classes. Explain the rule and authorized override, preserve an appeal/audit trail and recheck policy on every connector/export/AI path. Device/offline protections cannot retract a copy already downloaded; policy never promises that they do. Nook encrypts transport and stored credentials. Hosting, subprocessors and model retention/training terms are disclosed; customer content is excluded from model training unless the organization explicitly opts in.

**Acceptance.**
1. Label a private channel, attempt a restricted external share, connector post, export and AI retrieval, and observe the configured block/warning.
2. Exercise an approved override and revoke it; inspect policy history and deletion of derived content after source erasure.

#### NOOK-041 — Slack export import and guarded undo

*Tier:* Core · *From:* NOOK-041 · *Rules:* D-1, D-2 · *Register:* R-8

**Requirement.** Import official Slack export ZIPs within the exporter’s actual authority, including public/private channels, one-to-one/group DMs and shared-channel history where supplied. Preview identities, memberships/audience, date coverage, messages, threads, reactions, edits/deletions, pins/saves, bot provenance and file bytes/references with explicit unsupported/missing accounting. Map identities and private audiences deliberately, never by display-name collision. Fetch permitted files using a scoped approved source grant or supplied bytes; list inaccessible files and require a reviewed disposition. Resume/dedupe by source identity, reconcile every record and retain immutable provenance. Imported history creates no unread, notifications, bot/workflow runs or accepted work. Guarded batch undo preserves later native discussion.

**Acceptance.**
1. Use an authorized real Slack workspace export plus synthetic adversarial coverage, preview without writes, resolve an identity collision and a missing file, import public/private/DM/shared histories, verify complete counts/bytes/threads/search and deny outsiders.
2. Interrupt/resume and undo a batch after native activity, confirming refusal where undo would destroy that activity.

#### NOOK-102 — Slack integration cutover checklist

*Tier:* Core · *From:* NOOK-041

**Requirement.** The preview lists every app, bot, incoming webhook, slash command and workflow found in the export (the integration log, bot messages and bot profiles, and workflow data where supplied) with its Nook disposition: repoint to a NOOK-063, NOOK-113 Slack-compatible webhook or app (issuing the new URL/token), replace with a named first-party connector (NOOK-027–030), replace with a NOOK-064 Zapier/Make/n8n path, rebuild as a NOOK-026 workflow, or unsupported with its reason. Third-party-hosted Marketplace apps the buyer cannot repoint get a named Nook replacement where one exists: Polly and Simple Poll map to NOOK-070 polls, Geekbot and Standuply to the NOOK-026 stand-up template, Donut to the NOOK-026 intro-pairing template, and reminder and birthday apps to NOOK-033 reminders or a NOOK-026 template. Cutover yields an owner checklist and no integration is silently dropped. Source export-plan restrictions are shown, never solved by making private content public.

**Acceptance.**
1. The preview lists every integration in the export with its disposition, and repointing one incoming webhook delivers to the mapped channel.
2. The integration checklist for Polly, Geekbot and Donut names the polls, stand-up and intro-pairing replacements.

#### NOOK-103 — Consented Slack member history

*Tier:* Core · *From:* NOOK-041 · *Rules:* D-1 · *Register:* R-8

**Requirement.** Consented member source for what the export omits: Slack's official export on Free and Pro plans contains public channels only (private channels and DMs need Business+ after applying, or Enterprise), so for every conversation the supplied export does not include, each member may sign in to Slack through Nook with a user-token OAuth grant limited to reading their own history (private-channel, DM, group-DM, file and directory read scopes for identity mapping), shown before consent with exactly what will be read. Nook fetches only the private channels, DMs and group DMs that member belongs to (the authorized conversation and thread-history reads, file bytes through that token) into a staged preview that only that member can see; no owner, admin or other member reads staged content, and an admin role never consents for anyone. A staged conversation is published to its Nook audience only when its audience rule is met: a 1:1 DM or group DM needs every participant's consent (their own grant or an in-Nook consent on the staged item); a private channel needs its Slack channel manager's consent or, where none is in Nook, the member quorum the owner states before the run (default: a majority of its current members) with no explicit objection; and it imports to exactly its Slack membership through reviewed identity mapping. File bytes, threads, reactions, edits/deletions, provenance (`slack-member-grant` and the granting member), resume and dedupe by source ID (overlapping fetches from several members yield one record), inert import and guarded batch undo apply exactly as for the export. Revoking a member's Slack grant, in Nook or at Slack, stops further fetches with that token at the next request; already published conversations stay, and that member's unpublished staged items are erased unless another consenting member's grant covers them. Staged content that never reaches its audience rule is erased after an owner-set window (default 30 days). The cutover report lists every conversation not imported by type, member count and missing consents; nothing is silently dropped. Through the owner's approved source grant, custom emoji (the source emoji directory with image bytes and aliases) and user groups (the source user-group directory and its memberships) are imported so custom-emoji reactions render and `@group` mentions map to Nook user groups (NOOK-065).

**Acceptance.**
1. Slack Pro consented path: on a Slack Pro test workspace with a private channel, a 1:1 DM, a three-person group DM, custom emoji, a user group and files, import the official public-only ZIP, then have members grant their Slack user tokens.
2. Two of three group-DM members consent: the group DM stays unpublished and the cutover report lists it with its member count and the missing consent.
3. Both 1:1 participants consent: the DM imports with its threads and file bytes and only those two can read it.
4. The private channel's manager consents: it imports to its exact membership.
5. Revoke one member's grant mid-run and see no further fetch with that token in the Slack request log. An outsider, and the owner and an admin who are not members, find none of this content by search, link, export or API. Custom-emoji reactions and an `@group` mention render after import.

#### NOOK-104 — Slack cutover invitations

*Tier:* Core · *From:* NOOK-041 · *Rules:* D-1

**Requirement.** Cutover invitations: the cutover preview lists every active Slack member from the export's the export’s user directory, or from the owner's approved source grant with the source email-directory scope where the export lacks addresses. Each row shows the Slack user ID, email, name and a proposed Nook role. Full members are proposed as members, and Slack Workspace Owners and Admins are flagged so the owner may choose admin; admin is never granted without that explicit choice. Multi- and single-channel guests (`is_restricted`, `is_ultra_restricted`) stay guests limited to their mapped channels. Deactivated users (`deleted`) and bots get no invitation, while their history still imports under their reviewed identity. A member with no address is listed as needing one, never guessed. After editing roles, the owner sends every invitation in one reviewed action, now or at a chosen cutover time that survives restart. Accepting an invitation claims that person's imported authorship through the reviewed Slack-user-ID mapping recorded on the invitation, never by display-name match, and opens the consented member source to them. The cutover report shows invited, joined, pending and bounced counts per role and resends pending invitations in one action. Joining changes no private channel or DM audience, and invitation emails carry NOOK-126's code, open-in-app link and QR code. Slack Connect participants from other organizations are not in the export’s user directory; their channels and external DMs get their own preview, dispositions and report under NOOK-076. Final catch-up: everything posted, edited, deleted or created in Slack between the first import and the switch is brought across by NOOK-077's delta passes; the cutover time above runs NOOK-077's final pass before the invitations are sent, and the report states the time through which Slack history is imported.

**Acceptance.**
1. import a Slack Pro export with 120 active members, 3 guests and 5 deactivated users. The preview proposes 120 member and 3 guest invitations and excludes the 5 deactivated users and every bot. Send them in one action at a scheduled cutover time across a restart. An accepting member sees their imported messages attributed to them, a guest sees only their mapped channels, and the report shows joined and pending counts. No private channel or DM audience changes as people join.

#### NOOK-105 — Slack personal setup import

*Tier:* Core · *From:* NOOK-041 · *Rules:* D-1, D-2

**Requirement.** Personal setup: through a member's consented grant, Nook also imports what Slack lets that member read for themselves: their reminders (the source personal-reminder read scope) as NOOK-033 reminders (future ones fire at their time, past ones import as completed) and their starred items (the source starred-item read scope, where Slack still returns them) as NOOK-020 saved items, visible only to that member. Onboarding and the cutover report state plainly which personal setup Slack gives to no export or API and must be set again (sidebar sections, per-channel notification levels and mutes, scheduled messages, and saved "Later" items the API does not return), with a checklist linking each to its Nook setting.

**Acceptance.**
1. a member with a consented grant finds their future Slack reminders as Nook reminders that fire on time and their starred messages as saved items, visible to no one else; onboarding lists sidebar sections, notification levels, mutes, scheduled messages and Later items as needing to be set again.

#### NOOK-106 — Slack links after cutover

*Tier:* Core · *From:* NOOK-041 · *Rules:* D-1

**Requirement.** Slack links in imported history: every Slack message permalink (`https://<workspace>.slack.com/archives/<channel>/p<ts>`, with or without `thread_ts`), `slack://` link and `<#C…>`/`<@U…>` reference in imported messages, pins, bookmarks, topics and purposes is resolved through the import's Slack-ID map and rendered as the Nook permalink of the imported message, thread, channel or person; the original URL stays in provenance and the imported revision is unchanged. A link whose target was not imported, or whose target the reader cannot currently read, renders as "Slack message not imported" (or "Not available to you") with the original URL and never reveals the target's content, name or audience. A Slack permalink pasted into Nook after cutover resolves the same way under the reader's current ACL, and the cutover report counts resolved and unresolved links.

**Acceptance.**
1. an imported message linking to another imported thread opens that Nook thread; a link to a private channel that was not imported, or that the reader is not in, shows "Slack message not imported" or "Not available to you" with the original URL and no content; a Slack permalink pasted after cutover opens the mapped Nook message; the cutover report counts resolved and unresolved links.

#### NOOK-042 — Microsoft Teams migration

*Tier:* Core · *Rules:* D-1 · *Register:* R-8

**Requirement.** Import an authorized Microsoft Graph Teams extraction with paginated channel, chat and meeting-chat messages, replies, edits/deletions/reactions, users, membership/history-access limits and permitted SharePoint/OneDrive attachments. Record source IDs, timestamps, source tenant, export authority and omissions. Preview all mappings and count reconciliation; unknown historical audience stays unpublished. Source roles/meeting attendance never imply Nook admin or DM membership. Apply the same inert history, resumability, file accounting and safe batch undo guarantees as NOOK-041.

**Acceptance.**
1. Extract a real test tenant containing channels, private/shared channels, 1:1/group/meeting chats and protected files; page every source set, preview, import and verify counts, chronology and visibility.
2. Revoke an export scope, interrupt/resume and undo without deleting later native work; show each omission.

#### NOOK-043 — Google Chat migration

*Tier:* Core · *Register:* R-8

**Requirement.** Import supported Google Takeout and authorized Workspace administrator exports of spaces, group/individual DMs, threads, membership and available attachments. Record organization/source scope, external-space ownership omissions, author/time, edits and relationships actually supplied. Review identity/audience mappings without merging DMs into discoverable spaces, reconcile all files and retain source provenance. Apply inert publication, resumability/deduplication and guarded undo; unavailable private/external history remains an explicit gap.

**Acceptance.**
1. Import a real Workspace test export with spaces, threaded replies, DMs and files plus an externally owned space omitted by source policy.
2. Compare coverage and exact visibility, interrupt/resume and undo after native activity, and confirm no notifications, accepted tasks or outsider access.

#### NOOK-044 — Campfire ONCE migration

*Tier:* Core · *Register:* R-8

**Requirement.** Provide version-declared import from a consistent administrator Campfire ONCE backup containing its SQLite snapshot and uploads. Preserve room open/closed visibility, DMs/participant sets, authors, times, replies and file relationships that the source supplies. Reject inconsistent or unsupported schema versions and ambiguous memberships before publication. Preview/reconcile counts and file hashes, map identity without source-password reuse, import inertly with provenance and support resumable apply plus guarded undo.

**Acceptance.**
1. Take a consistent genuine upstream Campfire fixture backup with open/closed rooms, DMs and uploads, preview and migrate it, then compare messages/files and deny unrelated members.
2. Reject an incomplete/unsupported backup and exercise resume and safe undo.

#### NOOK-045 — Zulip migration and topic continuity

*Tier:* Core · *Rules:* D-1 · *Register:* R-8

**Requirement.** Import a versioned logical Zulip organization JSON/tar export with uploads, channels/streams, topics, subscriptions and private recipient groups. Preserve channel-plus-topic navigation and source links rather than flattening topics into an unreadable transcript. Show whether source scope is public-only, private-with-consent or complete-private and account for withheld data. Passwords/API keys never become destination authority. Use reviewed mappings, inert history, complete reconciliation, resumable deduplication and guarded undo.

**Acceptance.**
1. Export a real Zulip test organization with two topics in one channel, private conversations and uploads; import and navigate each topic independently, inspect consent omissions and verify private audiences.
2. Resume once without duplicates and undo while preserving later native work.

#### NOOK-046 — Mattermost migration

*Tier:* Core · *Rules:* D-1 · *Register:* R-8

**Requirement.** Import supported Mattermost bulk JSONL and attachment exports with teams, public/private channels, direct/group conversations, memberships, authors/timestamps, replies, reactions, custom emoji and saved/pinned state where supplied. Preview unsupported/deleted records and deliberate source-role mappings; no source admin becomes a Nook custodian automatically. Reconcile source/file counts and hashes, preserve provenance and use inert resumable apply and guarded undo with private audiences intact.

**Acceptance.**
1. Use a genuine upstream Mattermost export fixture spanning two teams, private channels, DMs, replies, saved/pinned items and attachments.
2. Review/map roles, import and find every declared item while denying outsiders; interrupt/resume and undo without removing subsequent Nook messages.

#### NOOK-047 — Readable portability and controlled exit

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-ROLE-001, BASE-DATA-006 · *Rules:* D-1

**Requirement.** Alongside full operational backups, provide user-readable versioned JSON/JSONL and HTML conversation/thread exports with membership history, message versions/tombstones, reactions, decisions, commitment acceptance history, source mappings and checksum-indexed file bytes/links. An ordinary member may export only conversations and DMs they currently belong to. A current workspace owner may export the whole workspace, including private conversations and DMs, only under an explicit, default-off, versioned workspace export policy. Enabling that policy must be announced to every member and recorded in the audit log with who enabled it, when and the policy version before any workspace export includes private conversations. Each workspace export states the policy version it ran under; current ownership and the enabled policy are checked throughout the job. An admin who is not an owner is refused another person’s DM. Protected held copies are excluded and named as excluded without disclosing any hold inventory. NOOK-039 later extends compliance authority beyond this owner policy; neither policy changes ordinary chat access. The readable membership report retains older events whose direction or time was not recorded as "unknown" and records exact joins and leaves from adoption forward, never inventing history. Include workflow/app definitions, non-secret configuration and agent run history, while naming installation-local credentials, held data and unsupported external artifacts. Provide a stable documented format a buyer can re-import elsewhere and a resumable completeness report; never silently truncate.

**Acceptance.**
1. Export a member-scoped conversation and all conversations and DMs the member currently belongs to; exclude a private conversation they never joined and one they left, and refuse subsequent access after membership revocation.
2. As a current workspace owner, attempt a whole-workspace export with the default-off policy disabled and refuse it.
3. Enable a versioned workspace export policy: every member receives the announcement and the audit records who, when and the policy version before an export includes other private conversations.
4. Export the populated workspace, private conversations and DMs included, and verify that the export states that policy version; disabling the policy or losing ownership blocks further workspace export access.
5. Attempt another person’s DM as an admin who is not an owner and refuse it.
6. Exclude protected held copies and name that exclusion without revealing any hold inventory.
7. Include an older membership event lacking direction or time: the readable report says "unknown", while exact joins and leaves after adoption retain their recorded direction and time.
8. Read the HTML offline, enumerate JSON/file hashes against the source, cancel/resume a large job, and verify all omissions are named. A successful operational backup alone does not prove readable exit.

#### NOOK-048 — Team administration and reporting

*Tier:* Core · *Rules:* D-1

**Requirement.** Authorized admins see membership/guest/app inventory, channel growth/activity, storage, retention jobs, client health, notification delivery classes, failed workflows and connector health over chosen time ranges. Team leaders see accepted/overdue/blocked commitments and unresolved decisions only within their authorized conversations, with drill-through to source and CSV export. Reports disclose denominator, time zone, freshness and missing data; aggregate trends cannot expose private-channel names or DM bodies and do not turn presence/message counts into employee performance scores. RL-9 records the carried policy decision. Team leaders are current full-member channel managers, owners or admins, limited to conversations they can read. Unreadable private channels, DMs and group DMs form one anonymous bucket, suppressed below five conversations in the page, JSON and CSV under RL-9.

**Acceptance.**
1. Populate a US 35-person team with guests, a private management channel, missed notifications and overdue linked work.
2. Compare filtered report totals to authorized records, export CSV, remove a viewer’s access and verify both aggregates and drill-through stop exposing that scope; show a failed sync as incomplete data.
3. Repeat totals and drill-through at the NOOK-049 capacity installation (1,000 members, 5,000 channels).

#### NOOK-049 — Team capacity and complete directories

*Tier:* Core · *From:* NOOK-049 · *Cites:* BASE-BACKUP-001, BASE-OPS-001, BASE-OPS-002, BASE-OPS-004 · *Rules:* D-1 · *Register:* R-7

**Requirement.** Serve an owned small/mid-size team without a paid history cutoff, with durable ordered messaging, idempotent retries, reconnect catch-up and explicit pending/error states. Supported minimum capacity per installation, measured on the supported hosted configuration: 1,000 members including guests, all concurrently connected on up to 3,000 devices; 5,000 channels plus DMs and group DMs; a largest channel of 1,000 members (the whole organization in its default channel); 7 years and 25 million messages of searchable history plus 2 TiB of files; sustained 50 messages per second organization-wide with 200-per-second bursts. Objectives at that size: sent-to-visible p95 ≤ 1 s and p99 ≤ 3 s for online recipients in the same US region, and p95 ≤ 2 s to the last recipient of a 1,000-member channel; reconnect catch-up (history, edits/deletes, unread and Attention) for a member of 200 channels after 24 hours offline p95 ≤ 5 s; search p95 ≤ 1.5 s over the full corpus; 99.9% monthly availability for send and read, measured and published; RPO ≤ 24 h from owned backups (≤ 1 h where the platform's point-in-time recovery is enabled) and RTO ≤ 4 h. People, channel, conversation, user-group and app directories and the channel browser page and search completely at any size, with no 1,000-entry cap. A larger size is supported only when published with its measurement; approaching a platform limit shows a named warning, never silent truncation.

**Acceptance.**
1. On the supported hosted configuration, seed 1,000 members, 5,000 channels, 25 million messages over 7 years and 2 TiB of files; drive 1,000 connected clients at 50 messages/s with 200/s bursts and a 1,000-member default channel, and measure sent-to-visible p95/p99, last-recipient fanout, 24-hour reconnect catch-up, complete reconnect count and search latency against the stated objectives.
2. Page the people directory and channel browser past 1,000 and 5,000 entries and find the last entry by search.

#### NOOK-107 — Component health and measured recovery

*Tier:* Core · *From:* NOOK-049 · *Cites:* BASE-BACKUP-001, BASE-OPS-001, BASE-OPS-002, BASE-OPS-004 · *Register:* R-7

**Requirement.** Publish measured latency/error/fanout/storage results against these objectives, plus a tested outage/upgrade runbook; do not infer hosted availability from local emulation. Health and monitoring separate chat persistence, fanout, notification providers (the NOOK-078 push gateway, APNs, FCM and browser push services, each named in an outage), integrations, schedulers and media. Dependency outage keeps durable local work inspectable, marks blocked effects and resumes only safe work; no fabricated success or silent loss.

**Acceptance.**
1. Interrupt fanout/provider access, restart workers, upgrade without data loss, restore from an owned backup within RTO and compare outcomes to the published objectives and component status.

#### NOOK-050 — Owned Nook deployment and data location

*Tier:* Core · *From:* NOOK-050 · *Cites:* BASE-INSTALL-001, BASE-OPS-002, BASE-SECRET-001, BASE-SECRET-002, BASE-DATA-004, BASE-DATA-005 · *Rules:* D-1

**Requirement.** Nook retains its private conversation identity mapping, private file custody, signed owner claim and editor authority across install and recovery. Owners choose the data location for D1/R2 at installation (US by default; EU or another platform-enforced jurisdiction where available), shown by setup and doctor with every subprocessor's region disclosed. Setup, doctor and `/docs` publish the subprocessor list: Cloudflare (Workers, D1, R2, Durable Objects), the configured mail provider, LiveKit Cloud or Twilio where media is configured, Apple APNs/PushKit, Google FCM, the browser push services and the publisher-operated Nook Push Gateway (NOOK-078, NOOK-133), each with its region, what it sees, its price and its terms, and owner-credential mode removes the gateway from that list; changing it is a documented export/restore migration.

**Acceptance.**
1. Follow README installation, first-run setup and invited sign-in with the configured hosted owner claim; upgrade, run doctor, export/reset/recover and inspect Nook’s conversation identity mapping, private file custody and erasure journal.
2. Inspect the disclosure of operator disk custody for Nook’s private conversations and files.
3. Install with an explicit data jurisdiction and confirm setup and doctor show it.
4. Open the subprocessor list in `/docs` and doctor: it names the NOOK-078, NOOK-133 Nook Push Gateway with its region, what it sees, availability objective, price and terms, and the reference estimate shows the gateway's price as its own line; switch to owner-credential mode and see the gateway leave the list and the developer account fees appear.

#### NOOK-108 — Measured operating costs

*Tier:* Core · *From:* NOOK-050 · *Cites:* BASE-INSTALL-001, BASE-OPS-002, BASE-SECRET-001, BASE-SECRET-002, BASE-DATA-004, BASE-DATA-005

**Requirement.** Expose US-first USD operating costs for hosting, storage, mail, media, AI and push/provider accounts without invented capacity or subscription promises. Publish a dated reference monthly USD operating-cost estimate for 50 and 300 active members, with its stated message, storage, media-minute, push, mail and AI assumptions (push includes the NOOK-078, NOOK-133 gateway's published price as its own line, and owner-credential mode adds the dated Apple Developer Program and Google Play developer account fees) and computed from measured unit costs each release, beside the dated Slack Pro and Business+ per-seat list prices it compares with; the installation shows its actual monthly cost per active member against that estimate. Stable user guides and supportable recovery accompany native-client/provider setup; no shared family code merges Nook into a sibling product.

**Acceptance.**
1. Reproduce on a real supported owner account and inspect actual USD provider usage separately from local/fake-account tests.
2. Open the published reference cost for 50 and 300 members, check its unit costs and assumptions against the measured release figures, and compare the installation's actual cost per active member with it.

#### NOOK-051 — Auditable authority and actions

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-AGENT-009 · *Rules:* D-1

**Requirement.** Nook's authority trail joins sign-in/session, invitations, roles, membership, app and specialist grants, workflow runs, exports, holds, policy and erasure events to their conversation scope and source version. Owners/admins see the trail; members and guests do not. Direct-conversation events disclose only a direct-conversation label and counts; private-channel labels match channel action history, with no copied bodies or credentials. Token labels and notification-app approvals identify their sources. Recorded creation/preparation times and explicitly labeled migration-observation times are never invented transition times. Admin override and posting-permission changes join the same log. [Audit source mapping](docs/contract/mechanism.md#nook-051) defines the record fields. Workflow, app and specialist actions link their source and grant, with an approval record only when the company’s policy called for one.

**Acceptance.**
1. Exercise membership revocation, export, erasure, an admin-override post and a posting-permission change, then filter and export CSV/JSON through owner/admin doors.
2. Deny members, guests and an erased actor; anonymize attribution and retain the action facts through archive restore.
3. NOOK-084 inherits: member digest-schedule enable/disable writes body-free `digest.enable` / `digest.disable` rows in the same batch.

#### NOOK-052 — Accessible, responsive daily use

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001 · *Rules:* D-1 · *Register:* R-3, R-4

**Requirement.** Preserve conversation/deep-link context and virtualized-history focus; announce activity without stealing focus and keep call captions and clip transcripts reachable. Quick switching finds readable or joinable conversations, people, DMs and recent threads by fuzzy name ranked by recency and unread. A private channel outside membership never appears, even by exact name. ⌘K (Ctrl K on Windows/Linux and web) opens a quick switcher that jumps by fuzzy name to any conversation, person, DM, recent thread or public channel to browse and join, ranked by recency and unread, listing only what the member can currently read or join (a private channel they are not in never appears, even by exact name). Web and desktop ship a Slack-equivalent shortcut set, shown in a ⌘/ (Ctrl /) shortcut sheet: ⌘⇧A All unreads and ⌘⇧T Threads (NOOK-071, NOOK-120), ⌘⇧K DMs, ⌥↑/↓ previous or next conversation, ⌥⇧↑/↓ previous or next unread conversation, ⌘[ and ⌘] back and forward, Esc marks the current conversation read, ⇧Esc marks all read (with undo), ↑ in an empty composer edits the member's last message, and ⌘F searches the current conversation (Ctrl and Alt replace ⌘ and ⌥ off macOS). Shortcuts never fire during IME composition and every one has a visible control equivalent.

**Acceptance.**
1. At both widths and on native clients, use keyboard to send/reply/search, accept work, upload, join a captioned call, migrate, change a policy and pause an agent.
2. Inspect realistic long names/history, enlarged text, focus after deletion/reconnect and error announcements; run scoped automated accessibility checks and record manual limitations.
3. Quick switcher and shortcuts: keyboard only on macOS, Windows, Linux desktop and the web, ⌘K/Ctrl K then "inc" and Enter opens `#incidents`; a private channel the member is not in never appears, even by exact name; ⌘⇧A opens All unreads and ⌘⇧T Threads; Esc marks the current conversation read and ⇧Esc marks all read with undo; ↑ in an empty composer edits the last message; ⌘/ lists every shortcut; a screen reader announces each result.

#### NOOK-053 — Conversation notes and lightweight lists

*Tier:* Core · *Cites:* BASE-DATA-006, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** Members maintain channel/thread notes or canvas and lightweight checklists linked to discussion, with version history, contextual pins and current conversation permissions. An item may propose a commitment, but an assignee accepts separately under NOOK-004/010; a checked box never impersonates acceptance or verified completion. Link substantial documents/knowledge to Google Drive, OneDrive, Notion or Chest and project plans to Vector. Export, retention, hold and erasure cover notes without broadening the product into a document editor or tracker. notes are shared conversation records, with separate channel-level and root-thread scopes. Any current participant may create, revise, pin, delete or revert them; every write compares the current version. Revert creates a new version with the reverting author and time. Checklist checking never accepts or verifies a commitment; a proposal copies the exact item text into NOOK-004/NOOK-010 and retains its source note/item/version. Provider URLs remain links labeled “link, not synced”; connectors inherit under NOOK-029. Retention and protected legal holds inherit the full note/history/export/erasure obligation under NOOK-038, which carries this clause's hold step. Deleting a note redacts all snapshots and links, and erasing a thread root clears its notes. Member erasure removes only the member's author, reviser and pin attribution from notes, snapshots and pins: a note another member authored or revised keeps its title, text, checklist items, links, pin state and complete version history for the other participants, with the erased member shown as a former member. A note is cleared with every snapshot only when the erased member wrote every version or authored its thread root, because erasing a thread root clears its notes. The same rule applies to existing snapshots and to restored archives. Previously downloaded copies retain NOOK-047 custody limits. Native clients inherit under NOOK-021.

**Acceptance.**
1. Create and revise a private channel note/checklist, link a provider document, propose an item to another person and require their exact acceptance.
2. Remove a member, export history and delete/hold the note; all sources keep their distinct permissions and authority.

#### NOOK-060 — Organization administration and delegated roles

*Tier:* Core · *From:* NOOK-060 · *Rules:* D-1

**Requirement.** Owners delegate explicit administrative permissions for people, channels, apps, security, billing/usage and compliance, with custom roles and user groups that never confer ordinary access to DMs. Support user-group mentions with visible recipients (channel-wide @channel/@here/@everyone are NOOK-065), guest expiry, invitation policy (who may invite members and guests, invitation links on or off with their maximum expiry and use limit, and invitation requests on or off) and approved email domains, each behaving as NOOK-018 defines, custom emoji with moderated upload, and org-wide defaults that members may override where permitted. Workspace settings enumerate who can create public and private channels, who can invite members and guests (and into which channels), the message edit and delete window (any time, never, or a set number of minutes, with audited admin exception), who can archive channels and who can use broadcast mentions (NOOK-065); default channels are auto-joined by every new member, or every member of a chosen group, at first sign-in. Owners set new-member notification defaults under NOOK-032, NOOK-100, NOOK-101: the push events that alert, a level for each default channel (for example `all new messages` on `#announcements`), and whether "Email me about mentions and DMs when I'm away" starts on; members may change their own. Bulk administrative actions preview affected scopes and retain audit; external shared-channel policy requires both orgs’ approval. It supplies user groups for NOOK-066 (named people and groups may post, reply and broadcast), NOOK-065 (named groups) and NOOK-103's `@group` mapping.

**Acceptance.**
1. As owner create a delegated channel admin and a user group, rename/archive/restore a populated channel, transfer ownership and schedule guest expiry.
2. Verify expiry/revocation across phone, desktop, search and bot access.
3. Restrict channel creation and guest invitation to admins and set a 15-minute edit window: a member's create, invite and late edit are refused through app and API, and a new member auto-joins both default channels.
4. Turn invitation links off and approve one domain: creating a link is refused and the domain appears in the approved list.
5. Set `#announcements` to `all new messages` and email on for new members: a member who joins afterwards starts with both, and an existing member's settings are unchanged.

#### NOOK-109 — Channel lifecycle and history disclosure

*Tier:* Core · *From:* NOOK-060 · *Rules:* D-1

**Requirement.** Manage channel name, topic, description, owner transfer, public/private policy, archive/restore and workspace navigation with history/audience disclosure before a privacy change; never widen private history silently.

**Acceptance.**
1. Preview/refuse a private-to-public conversion that would expose earlier history, exercise group mentions and custom emoji, and deny app/compliance/DM operations outside the delegated grant.

#### NOOK-061 — Large files, previews and admission policy

*Tier:* Core · *From:* NOOK-061 · *Cites:* BASE-INPUT-003

**Requirement.** Members attach any file type up to 1 GiB per file (Slack's bar) through resumable chunked uploads that survive network loss and app restart on every client. Common types preview in-app through NOOK-012's private, sandboxed, current-membership preview door: Word, Excel and PowerPoint (.docx/.xlsx/.pptx and legacy .doc/.xls/.ppt), PDF, CSV, plain text and code, images including HEIC/HEIF, animated GIF, WebP and SVG (rasterized, never executed), audio and video (MP4, MOV, WebM, MP3, M4A) with streamed playback and seek, and a .zip entry listing. Previews are rendered server-side into inert images, text or media segments; macros, scripts and external references never run or fetch. Owners and admins set allowed/blocked extensions and MIME classes, a lower size limit and storage policy; blocked types are refused before bytes are stored through every door: app, native share sheet, REST and Slack-compatible upload (NOOK-112), webhooks, workflows, forwarding, email-in and import. NOOK-012's private R2 custody, ordered binding, intent identity, deletion cascade and archive/erasure guarantees hold unchanged at this size, and NOOK-019 indexes extracted text from these types.

**Acceptance.**
1. Upload and download a .docx, .xlsx, .pptx, .csv, .zip, HEIC photo, animated GIF and an MP4 screen recording within 5% of the 1 GiB limit at 1440 and 390 and on native clients; interrupt one upload mid-way and resume it with no duplicate; preview each type in-app and compare downloaded bytes by SHA-256.
2. Block `.exe` as admin and see app, API and webhook uploads refused with no stored bytes; a file of 1 GiB plus one byte is refused.

#### NOOK-110 — Malware scanning and quarantine

*Tier:* Core · *From:* NOOK-061 · *Cites:* BASE-INPUT-003

**Requirement.** Every upload is malware-scanned (owned signature engine or a disclosed scanning subprocessor, signatures updated at least daily) before anyone else can download or preview it, and uploader and recipients see `scanning`, `clean`, `quarantined` or `scan failed`. A quarantined file has no download or preview path except an audited security-admin door, and the uploader sees why; a scanner outage holds files in `scanning` (or, by explicit owner policy, releases them labeled `not scanned`), never a silent clean.

**Acceptance.**
1. Upload the EICAR test file and see it quarantined for uploader and recipients with no download or preview path.
2. Stop the scanner and see new files held as scanning.

#### NOOK-062 — Private notification preview levels

*Tier:* Core · *From:* NOOK-062 · *Rules:* D-1

**Requirement.** Each member chooses per account and per device how much native push (NOOK-021), Web Push (NOOK-015) and email (NOOK-014) show: `full` (sender, conversation and up to 160 characters of message text), `sender` (sender and conversation only) or `generic` ("New message in Nook"). Defaults: push is `full`, matching Slack's "Include a preview of the message"; email is `sender` until the member turns message text on. Owners set an org cap (force `sender` or `generic`), separately for DMs, private channels, shared/external channels and email; caps and choices are applied when each payload is built, so a change governs the next notification, and NOOK-040 labeled conversations are capped at `sender`. Text previews use the current revision under current ACL, never include deleted text, file contents or urgent reasons beyond the message, and stay encrypted end to end to the device (RFC 8291 for Web Push; a per-device key decrypted in the iOS Notification Service Extension and Android data handler for APNs/FCM), so neither the NOOK-078 push gateway nor APNs/FCM ever sees message text, sender or conversation names; the badge count rides inside the encrypted payload, and a device that cannot decrypt shows only the fixed `generic` wording.

**Acceptance.**
1. With previews at the default, mention a member whose iOS and Android devices are locked: each lock screen shows sender, conversation and message text.
2. Turn on the org cap forcing `sender` and send again: the same event shows sender and conversation only, and the delivered payload contains no text.
3. Turn on email text and see it in the received email; turn it off and see the next email without text.
4. Capture the packets for a `full` notification at the NOOK-078 gateway: no message text, sender or conversation name appears.

#### NOOK-111 — Notification reply and mark-read actions

*Tier:* Core · *From:* NOOK-062

**Requirement.** Native notifications offer Reply and Mark as read (iOS text-input action, Android RemoteInput, macOS/Windows/Linux desktop actions; Web Push offers Mark as read and Open where the browser supports actions). A reply posts through the ordinary message API with an intent key derived from the delivery ID and device, so a retried action posts exactly once, and it rechecks the device session, current membership, NOOK-066 posting permission and NOOK-069 second-factor state at send; a refused reply raises a visible failure notification instead of vanishing. Owners may require device unlock before a notification reply (required by default on phone lock screens). Mark as read advances the read frontier to the notified message and clears that notice and the badge on the member's other devices.

**Acceptance.**
1. Reply from the lock-screen notification on both phones and from a desktop notification, drop the network once and retry: exactly one message posts under current membership.
2. Remove the member from the channel and reply from a stale notification: the reply is refused with a visible failure.
3. Mark as read from a notification and see unread, badge and the other device's notice clear.

#### NOOK-063 — Slack-compatible incoming webhooks

*Tier:* Core · *From:* NOOK-063 · *Cites:* BASE-OPS-003, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Existing Slack senders move by changing only the URL. Incoming webhooks post one chosen conversation as a named app, support JSON or form payloads, text, blocks, legacy attachment fallback, threads and declared formatting, and return Slack-compatible success/refusal outcomes. The [compatibility protocol](docs/contract/mechanism.md#nook-063) lists every field and result.

**Acceptance.**
1. Repoint an unmodified GitHub Actions `slackapi/slack-github-action` incoming-webhook step and a curl `{"text","blocks","thread_ts"}` payload to a Nook webhook URL: both render with their blocks and the threaded one lands in its thread.
2. Forge a signature, replay an old timestamp, post to an owners-only channel without permission and revoke the token: each is refused with Slack's error string and no message.

#### NOOK-112 — Slack-compatible Web API

*Tier:* Core · *From:* NOOK-063 · *Cites:* BASE-OPS-003, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Slack SDK apps move by changing only base URL and token. The [compatibility protocol](docs/contract/mechanism.md#nook-063) retains every promised method for identity, messages, reactions, conversations, people, profiles, app DMs, channel management, files, scheduled messages and modal views. Mapped Slack identities resolve imported records. Missing scopes, blocked app DMs and out-of-grant conversations disclose no extra authority. The company's policy decides any accountable agent call's computed classes; service-app scope conveys no person's confirmation. Rulings RL-4 to RL-7 state the degraded metadata, formatting and failure conventions; they waive no required method or journey. An app cannot edit or delete another app identity’s message. Native branding and origin metadata are degraded locators, not mapped Slack identities or a durable installation identifier across host changes.

**Acceptance.**
1. The same Bolt app calls `conversations.open` for a user and `chat.postMessage` into the result: that person receives one app DM showing the app identity.
2. It creates `#inc-123`, invites three responders, sets its topic and lists them with `conversations.members`; schedules a message with `chat.scheduleMessage` that posts once at its time; and advances a modal with `views.push` and `views.update`.
3. The person blocks the app and the next DM is refused with `messages_tab_disabled` and posts nothing; a second app without the channel-management scope gets `missing_scope` from `conversations.create`; and no other DM or group DM is readable through either token by conversation-history reads, `users.conversations` or events.

#### NOOK-113 — Slack event, command and interactive compatibility

*Tier:* Core · *From:* NOOK-063 · *Cites:* BASE-OPS-003, BASE-ROLE-001 · *Rules:* D-1

**Requirement.** Slack-compatible signed message, reaction, membership and link events use stable deduplication across retries. Commands support immediate private or channel responses, bounded follow-ups and interactive buttons, selects and modal submissions, through the [compatibility protocol](docs/contract/mechanism.md#nook-063).

**Acceptance.**
1. Run an unmodified `@slack/bolt` JavaScript app and a Python `slack_sdk` script with only base URL and token changed: `chat.postMessage` then `chat.update` edits one message; signed `message` and `reaction_added` events arrive once across a forced retry; a slash command answers ephemerally and through `response_url`; a button click returns `block_actions`.

#### NOOK-114 — Block formatting and compatibility disclosure

*Tier:* Core · *From:* NOOK-063 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Render the complete contracted Block Kit and text-format subset. Unsupported content has a visible text fallback and warning; publish an exhaustive supported, degraded or unsupported matrix for methods, events, fields and blocks. The recorded Web API rulings preserve cross-app refusals, native metadata limits and truthful error outcomes. Rulings RL-4 to RL-7 state the degraded metadata, formatting and failure conventions; they waive no required method or journey. Unsupported formatting keeps the text fallback and visible notice, and its Nook-specific warning claims no Slack validation equivalence. Transport acknowledgment does not establish application success; operation failures and rate refusals retain their distinct truthful outcomes.

**Acceptance.**
1. Post an unsupported block and see the text fallback, visible notice and warning.

#### NOOK-064 — Zapier, Make and n8n connectors

*Tier:* Core · *Rules:* D-1 · *Register:* R-9

**Requirement.** Nook publishes and maintains a public Zapier App Directory integration, a Make app and an n8n node over NOOK-025's OAuth 2.0 scoped grants. Triggers: new message in a chosen channel (optionally matching text), new mention of me, new direct message, reaction added (optionally a chosen emoji), new channel, new saved item, commitment accepted or completion reported, and approval decided. Actions: send channel message (with thread and blocks), send direct message, reply in thread, add reaction, set a reminder for a person (NOOK-033), schedule a message (NOOK-034), propose a commitment (it stays proposed until its assignee accepts) and request an approval (an interactive approve/decline message whose decision fires the approval trigger). Searches: find person by email, find channel, find message. Triggers use REST hooks with deduplicated polling fallback; every run appears in the app's delivery log with failures and uncertainty; posting permission (NOOK-066), file policy and current membership apply to every action, and revoking the grant stops new triggers and actions.

**Acceptance.**
1. In a Zapier sandbox or official-schema fake, run zaps end to end: a Nook "new message in #sales" trigger appends a Google Sheets row, and a Google Forms submission runs Nook "send channel message" and "request approval"; decide the approval and see the decision trigger fire once.
2. Repeat one trigger-plus-action scenario in Make and one workflow in n8n.
3. A "propose commitment" action stays proposed until the assignee accepts.
4. Revoke the grant and see the next run fail visibly with no post.

#### NOOK-065 — Channel-wide mentions: @channel, @here and @everyone

*Tier:* Core · *Rules:* D-1

**Requirement.** Members send `@channel` (every current member of the conversation except the sender), `@here` (current members with fresh active presence on any client: a foreground heartbeat within the last 10 minutes and status not set to away) and `@everyone` (every active non-guest member of the organization, admitted only in the designated organization-wide default channel and refused elsewhere with a hint to use @channel). Recipients are resolved once at commit against current membership and presence; identical retries never re-resolve, and broadcasts are not bounded by NOOK-013's 50 explicit individual mentions. A broadcast creates a `broadcast` Attention reason below explicit mention precedence, follows each recipient's push/email `broadcasts` choice (on wherever mentions are on, by default), is suppressed in muted conversations and by a per-conversation "Ignore @channel, @here and @everyone" choice, and is deferred by quiet time like routine items (it never uses urgent bypass). When a broadcast would reach six or more people, the composer confirms with the recipient count and how many are in other time zones or quiet time; the API requires `confirmBroadcast:true` or returns 409 with the count and commits nothing. Owners set who may broadcast (everyone, owners and admins, or named people and groups) with per-channel overrides under NOOK-066; a refused broadcast commits no message, and the same policy binds apps, Slack-format `<!channel>`/`<!here>`/`<!everyone>` webhooks, workflows and scheduled messages at firing time.

**Acceptance.**
1. In a 120-member channel with mixed choices, @channel creates Attention, push and email for every eligible member per their choices (none for the sender, muted or ignore-broadcast members; deferred for members in quiet time) and the delivered count equals 119 minus those exclusions. @here with 30 members in fresh presence reaches exactly those 30. @everyone in the default channel reaches every active non-guest and is refused in another channel.
2. Send through the API without confirmation and receive 409 with no message; confirm and see one send.
3. A member outside an owners-only broadcast policy, and a webhook `<!channel>` from an app without that permission, are refused with no message.

#### NOOK-066 — Channel posting permissions and announcement channels

*Tier:* Core · *Rules:* D-1

**Requirement.** Channel managers and admins set per-channel permissions: who may post top-level messages (everyone, owners and admins, channel managers, or named people and user groups), who may reply in threads (everyone or the same list), who may use broadcast mentions (NOOK-065) and which apps, webhooks and workflows may post. Members who cannot post still read, react, save, follow, open threads (and reply where replies are open) and forward under NOOK-067; their composer shows the restriction instead of a send box. Everyone may post by default. The permission is checked atomically with membership on every write door: app, native client, notification reply (NOOK-062, NOOK-111), REST and Slack-compatible API and webhooks (NOOK-112, NOOK-063), Zapier/Make/n8n (NOOK-064), workflows (NOOK-026), scheduled messages and reminders at firing time (NOOK-033/034), forwarding and email-in (NOOK-067) and agents (NOOK-054); a refused write commits nothing. Admin override posts are labeled and audited (NOOK-051), and every permission change is audited and shown in channel details.

**Acceptance.**
1. Set #announcements to owners-only posting with replies off.
2. A member's post, thread reply, notification reply, Slack-compatible webhook post, Zapier action, workflow post and a scheduled message created before the change are all refused (the scheduled one as a visible failed occurrence), while the member still reads, reacts and saves.
3. An owner posts; an admin override post is labeled and appears in the audit log.
4. Open replies and see the member's thread reply accepted.

#### NOOK-067 — Forwarding messages and email into conversations

*Tier:* Core · *Rules:* D-1

**Requirement.** From any message on every client, a member forwards to one or more channels, DMs, group DMs or a thread, with an optional note. The forward shows original author, original conversation (named only to recipients who can read it), time and a source link that opens only under the recipient's current membership. Public-channel sources forward with their body. From a private channel, DM or shared channel the sharer chooses Show message (an authorized, previewed and audited disclosure of that message's body and attachments to the destination audience) or Link only (attribution and link; a recipient without source access sees no body, attachment, excerpt, reactions or thread). Owners can restrict forwarding from private and DM sources to link-only or block it, and NOOK-040 labels apply. Forwarding needs posting permission in each destination (NOOK-066). Source edits update the forwarded snapshot; source deletion or erasure tombstones every forwarded copy by default, and a NOOK-038 hold preserves only the custodian copy.

**Acceptance.**
1. Forward a public message with a note into a DM on desktop and phone and see author, source and note; forward a private message into a public channel as Link only (public member sees attribution, no body, attachment, excerpt or thread, and the link refuses them) and as Show message (disclosure preview and audit entry); owner policy link-only refuses Show message; delete the source and see each forwarded copy tombstoned.
2. Forward to channels, fixed DMs, group DMs, several destinations and a destination thread, with current posting permission at each destination.
3. Public sources can show their body; Link only always carries attribution and a link without body or files.
4. A fresh audience-bound Show message disclosure creates a body-free audit event; owner link-only or blocked policy takes effect before copying.
5. Source edits propagate; source deletion, import undo and author erasure tombstone descendants and erase copied bytes. A hold preserves only the custodian copy under NOOK-038.

#### NOOK-068 — Safe link previews and app unfurls

*Tier:* Core · *Rules:* D-1

**Requirement.** Links pasted by people get a title, description, site name and image preview from a server-side unfurl service that fetches only http/https on ports 80 and 443; resolves DNS itself and connects only to the checked public unicast address, refusing loopback, RFC 1918, 100.64.0.0/10, link-local 169.254.0.0/16 (including cloud metadata), multicast, IPv6 loopback/ULA/link-local and IPv4-mapped forms, rechecked on every redirect (at most three) to defeat DNS rebinding; sends no cookies, credentials or Nook identity; stops at 5 s, 1 MiB of HTML and 5 MiB per image; parses Open Graph, Twitter cards and oEmbed for allow-listed providers such as YouTube, Vimeo, Loom and Figma; proxies and re-encodes preview images through Nook so viewers never contact the target; and caches each URL for at most 24 hours. Previews render inertly, with embedded players only from the oEmbed allow-list. Authors remove a preview from their message (removal persists), members hide previews for themselves or turn them off, and admins allow or deny domains, disable previews in private channels, DMs or shared channels and restrict third-party app unfurls. An app with a claimed domain receives `link_shared` (NOOK-025/113) and supplies blocks through `chat.unfurl`; the first time it would unfurl a member's link in a conversation, that member approves it. Connector cards (NOOK-029) use their own grants and are never fetched anonymously.

**Acceptance.**
1. Paste a public article URL and see title, description and image preview with the image served from Nook; paste a YouTube and a Loom link and see their oEmbed previews.
2. Paste links resolving to 127.0.0.1, 10.0.0.5 and 169.254.169.254 and a public URL that redirects to an internal address, and confirm through the fetch log and a listening internal server that nothing internal is contacted.
3. An installed app with a claimed domain unfurls its own link once the author approves.
4. The author removes a preview and it stays removed after reload on another device; an admin denies a domain and its links get no preview.

#### NOOK-069 — Organization second-factor enforcement

*Tier:* Core · *From:* NOOK-069 · *Cites:* BASE-SIGNIN-002, BASE-ACCESS-002

**Requirement.** Owners require second factors by member or role without an IdP. A magic link or any native sign-in path yields only a pending session until enrollment and challenge; private chat, search, live connections, exports and writes stay closed. Enforcement applies on the next request to existing sessions. Factor resets require a recent factor, revoke Nook sessions/devices, notify the person and enter the authority trail; the last owner uses recovery codes or documented offline recovery. Native clients support TOTP and passkeys; SSO uses provider MFA. [Factor protocol](docs/contract/mechanism.md#nook-069) preserves the specified timings, recovery and lockout limits.

**Acceptance.**
1. As owner, enforce 2FA.
2. A member without a factor signs in by magic link and reaches only enrollment: every private API, SSR page, live socket and export is refused until they enroll with TOTP; a second member enrolls a passkey on desktop and phone.
3. A captured magic link used from another browser opens no private access without the second factor.
4. Use a recovery code and see it audited and emailed; an admin resets a member's factors and the audit log, revoked sessions and notice show it; repeated wrong TOTP codes lock out with audit.

#### NOOK-115 — Own sessions and device revocation

*Tier:* Core · *From:* NOOK-069 · *Cites:* BASE-SIGNIN-002, BASE-ACCESS-002

**Requirement.** Every member, with or without SSO, sees their own active sessions and devices (client, OS, sign-in method, approximate location and last activity) and can sign out any one or all others; signing out a native device also revokes its push registration and purges its offline cache at its next contact (NOOK-021).

**Acceptance.**
1. The member opens their own sessions list, sees a phone and two browsers, signs out the phone and then all others: the phone loses private access and push at its next contact and the other browsers return to sign-in.

#### NOOK-070 — Conversation polls

*Tier:* Core · *From:* NOOK-070 · *Rules:* D-1

**Requirement.** Members create polls in any conversation they may post to (single or multiple choice, up to 20 options, named or anonymous votes, optional close time) with live counts visible to current members and results kept in export; a vote is never a decision or accepted commitment.

**Acceptance.**
1. Create a named and an anonymous poll, vote from desktop and phone, close it and see the final count; a non-member cannot vote.

#### NOOK-116 — GIF search and posting

*Tier:* Core · *From:* NOOK-070

**Requirement.** A GIF picker searches GIPHY or Tenor through a Nook proxy that withholds viewer identity, with an admin on/off switch and content rating (G/PG by default); chosen GIFs post as images under NOOK-061 policy. `/gif [words]` (NOOK-091) runs this clause's GIF search.

**Acceptance.**
1. Post a GIF through search under the rating cap, then disable GIFs as admin and see the picker gone.

#### NOOK-117 — Thread replies also sent to channel

*Tier:* Core · *From:* NOOK-070 · *Rules:* D-1

**Requirement.** A thread reply can also be sent to the channel ("Also send to #channel"), appearing in both places as one message with one edit/delete and its thread link.

**Acceptance.**
1. Send a thread reply also to the channel, edit then delete it and see both places update once.

#### NOOK-118 — Channel bookmarks

*Tier:* Core · *From:* NOOK-070 · *Rules:* D-1

**Requirement.** Channels carry a bookmarks bar of links, files and folders that permitted members add, reorder and remove, with audit and ACL-checked previews.

**Acceptance.**
1. Add, reorder and remove channel bookmarks as a permitted member and be refused as a restricted one.

#### NOOK-119 — On-request message translation

*Tier:* Core · *From:* NOOK-070

**Requirement.** On demand a member translates a message into their chosen language with the original one tap away; translation follows the organization's AI policy (NOOK-040), keeps no copy beyond the message's retention and never edits the source.

**Acceptance.**
1. Translate a Spanish message into English and return to the original.

#### NOOK-071 — Followed Threads view

*Tier:* Core · *From:* NOOK-071 · *Rules:* D-1

**Requirement.** A sidebar Threads view lists every thread the member follows (explicitly under NOOK-013, or automatically under NOOK-072 because they authored it, replied in it, were mentioned in it or it is in a one-to-one DM, plus every thread in a conversation they set to all thread replies) across conversations they can currently read, ordered by newest unread reply, with unread reply counts, inline reply and mark-read; threads in a muted conversation appear only when explicitly followed, and losing membership removes a thread from the view at the next request. Reads in the view advance the same per-thread read state as the conversation (NOOK-005) on every device.

**Acceptance.**
1. Follow three threads across two channels and a DM, receive replies and see them in the Threads view with unread counts at 1440 and 390; reply inline, mark one read and see it read on a second device; lose membership of one channel and see its thread leave the view.
2. Threads the member started, replied in or was mentioned in appear without an explicit follow (NOOK-072), and an unfollowed one leaves the view.

#### NOOK-120 — All unreads view

*Tier:* Core · *From:* NOOK-071 · *Rules:* D-1

**Requirement.** An All unreads view (a sidebar entry the member may hide, and ⌘⇧A / Ctrl Shift A) lists every conversation with unread messages in sidebar order, each with its unread messages in order and the member's current ACL applied, with mark-read per conversation and Mark all read with a ten-second undo; its reads advance the same NOOK-005 frontier on every device and never close Attention or accept work.

**Acceptance.**
1. All unreads: with unread messages in three conversations, ⌘⇧A lists them in sidebar order; marking one read removes it and clears it on a second device; Mark all read clears the rest and undo within ten seconds restores them; no Attention item closes.

#### NOOK-121 — Group-DM conversion to private channel

*Tier:* Core · *From:* NOOK-071 · *Rules:* D-1

**Requirement.** Any participant with current authorized access can convert a group DM into a private channel, named at conversion, preserving its full history and retaining the complete fixed original participant roster as read-only history. Only participants who still hold authorized access at conversion time become channel members; anyone who left or lost access stays out until an explicit regrant under NOOK-018, and conversion never restores their private-history access. The group DM stays fixed under NOOK-003, becomes read-only and links to the channel. The conversion is shown in both conversations and audited (NOOK-051); it never widens the audience, and later invitations and regrants follow ordinary channel membership.

**Acceptance.**
1. Convert a three-person group DM into private channel `#proj-x`: with all three still authorized, its members are those three, its full history is present and its complete original roster is retained as read-only history, the group DM is read-only with a link, an outsider cannot discover either, and the audit log shows the conversion.
2. Repeat after one participant, including the original creator, leaves or loses access: the complete original roster remains as read-only history, but only the two currently authorized participants become members, and the converter manages the channel.
3. Reactivate the removed participant: they still cannot read the channel or private history until an explicit channel regrant under NOOK-018.
4. Export and restore before and after that regrant, restart, and verify the same roster, membership and access boundaries.

#### NOOK-072 — Automatic thread follows

*Tier:* Core · *From:* NOOK-072 · *Rules:* D-1

**Requirement.** In a channel, private channel, shared channel (NOOK-031) or group DM, a member automatically follows a root thread when they author its root, post a reply in it, or are explicitly mentioned or broadcast-mentioned (NOOK-065) in its root or a reply; in a one-to-one DM both participants follow every thread by default. The follow is written atomically with the committing message and is the same followed state as NOOK-013's explicit follow: it appears among the followed root-thread IDs from conversation preferences, each with its `source` (`explicit`, `authored`, `replied`, `mentioned`, `dm` or `all`), and drives the `thread-follow` Attention reason, the "replies in followed threads" alerts of NOOK-015, NOOK-021 and NOOK-032, unread counts and badges, and the NOOK-071 Threads view. A member's own replies never alert them, and imported history (NOOK-041–046) never creates follows of any kind; a native reply in an imported thread follows as usual. Any member can unfollow any thread from its menu, the Threads view, a notification action or the explicit unfollow action. An unfollow sticks: a later mention of that member alerts as a mention but does not re-follow, while a later reply by that member re-follows. In a muted conversation, NOOK-013's mute still suppresses routine follow alerts, and losing membership leaves the follow dormant: it never routes or reveals the thread until membership returns.

**Acceptance.**
1. With every member signed in on a phone and a desktop app and not active on desktop (NOOK-073), in a `#sales` channel at the default `mentions` level, A posts a root message and B replies in its thread without mentioning A: A's phone and desktop each alert once, the thread shows in A's Threads view with one unread reply, and A's preferences list it with source `authored`.
2. C replies once; D's later reply alerts both A and C.
3. E is @-mentioned in the thread, then F replies, and E is alerted for F's reply.
4. C unfollows: the next reply does not alert C; G then @-mentions C in the thread and C receives only that mention alert, and the following plain reply does not alert C; C replies again and the next reply alerts C.
5. In a one-to-one DM, a reply in any thread alerts the other participant.
6. Removed members receive no alert or Threads row. Importing history creates no follows or alerts; a first native reply in an imported thread follows normally.

#### NOOK-122 — All replies and follow-source visibility

*Tier:* Core · *From:* NOOK-072 · *Rules:* D-1

**Requirement.** All thread replies: per channel, private channel, shared channel or group DM, a member may set `threads` to `all` (default `followed`), with an optional different `mobileThreads`, through conversation notification settings and every client. Every thread in that conversation then counts as followed for that member, every reply alerts and appears in their Threads view, and a per-thread unfollow still wins. conversation preferences returns both `threads` (root IDs) and `threadFollows` (objects with `message` and `source`): live roots without a stored follow return virtual source `all` when either `threads` or `mobileThreads` is `all`, with per-thread unfollows excluded. A stored follow keeps its original source. the Threads view likewise returns source `all` for those virtual entries under current membership, import-publication and mute rules; no stored follow is created by this view. It follows NOOK-100's mobile override, exception list and `nothing` level and NOOK-032's quiet schedule (which keeps those replies silent in the Threads view), NOOK-062 previews and the NOOK-014/NOOK-015 gathering and ten-minute folding rules.

**Acceptance.**
1. With `#incidents` set to all thread replies, a reply in a thread the member never touched alerts them and appears in their Threads view, and the NOOK-032, NOOK-100 exception list shows `#incidents`.
2. Request conversation preferences and the Threads view: the untouched live root is in `threads`, its `threadFollows` entry has `message` equal to that root ID and `source: "all"`, and its Threads item also has `source: "all"`; existing stored follows keep their sources.
3. Repeat with only `mobileThreads: "all"`, then unfollow the untouched root and verify both endpoints exclude it.

#### NOOK-123 — Mentions-only thread badge choice

*Tier:* Core · *From:* NOOK-072

**Requirement.** Thread badge choice: followed-thread replies count toward unread and every device's badge by default; a member may choose "Count thread replies only when they mention me", applied identically to the native (NOOK-021) and Web Push (NOOK-015) badges, and those replies still appear in the Threads view.

**Acceptance.**
1. With the mentions-only thread badge chosen, a non-mentioning followed reply leaves phone and desktop badges unchanged while remaining in Threads.

#### NOOK-073 — Active-elsewhere alert routing

*Tier:* Core · *From:* NOOK-073 · *Rules:* D-1

**Requirement.** A member is *active on desktop* while any of their desktop apps (NOOK-021) or web clients has had user input (keyboard, pointer or window focus) within the last 10 minutes and its OS session is not locked; locking the screen, or the OS reporting the session locked or asleep, ends that client's activity 1 minute after the lock. Activity comes from the same signed, session-bound heartbeat on every client (the signed device-presence door, renewed every 15 seconds while visible), never from an open socket alone; a heartbeat from a revoked session, a removed device or an inactive account does not count, and a client whose heartbeats stop (crash, sleep, network loss) stops counting when its last heartbeat expires after 45 seconds, so a lost laptop never holds alerts for 10 minutes. While a member is active on desktop, eligible alerts go to their desktop and web clients only, and phone and tablet alerts for those events are held. A held mobile alert is released when the member becomes inactive, after their chosen delay (immediately by default, or 1, 2, 5, 10, 15 or 30 minutes after becoming inactive), folded with other held items under the NOOK-014/NOOK-015 ten-minute conversation folding rule, and canceled if the event is read or done on any device first (NOOK-005, NOOK-014, NOOK-015). A member may instead choose "Always send to mobile, even when I'm active", per account or per device, through the member’s mobile-routing settings and every client. Call invites (NOOK-022) and urgent requests the member lets bypass quiet time (NOOK-032) ring or alert every device regardless of activity.

**Acceptance.**
1. A member uses the macOS app with the default setting and their phone unlocked on the desk.
2. A DM and a mention alert on the desktop only, and the phone stays silent; the device delivery view shows both held for the phone.
3. The member reads the DM on the desktop, then locks the screen: about 1 minute later only the unread mention alerts on the phone, exactly once, and the DM is recorded as `held-active-elsewhere`.
4. With the desktop idle for 10 minutes and unlocked, a new DM alerts the phone.
5. Force-quit the desktop app while active: the phone alerts for a new DM within 45 seconds plus the delivery bar.
6. Switching to "Always send to mobile, even when I'm active" makes the next DM alert both devices.
7. With a 5-minute delay chosen, a mention after locking alerts the phone 6 minutes after the lock (1-minute lock threshold plus the delay).
8. A call invite rings the phone while the member is active on desktop. Repeat with a focused web client in Chrome in place of the desktop app, and on Windows and Linux.

#### NOOK-124 — Device delivery history and routing custody

*Tier:* Core · *From:* NOOK-073

**Requirement.** The member's device delivery view shows, per device, its activity, last input, lock state and current routing (for example "Phone held: active on MacBook"), and lists each held, released and canceled alert with its reason. Held means any hold that view explains: activity on a desktop or web client, the chosen mobile delay, a NOOK-032 quiet schedule or quiet snooze, or a NOOK-013 item snooze. The view may be bounded, but every held, released and canceled alert is retained body-free with its alert, hold and cancellation reasons, hold and release times and outcome beyond the view's window; it travels in operational backup and restore, appears only in the member's own readable export, and is removed when that member is erased or when the message, outcome or member that caused it is erased (NOOK-015). Retention policy for these records is NOOK-038's. Email entries in the same view follow NOOK-014 and NOOK-032. NOOK-097's delivery bar is measured against this routed device set: a held mobile alert canceled by a read is recorded as `held-active-elsewhere`, neither displayed nor missed nor silently dropped, and a released one is timed from its release. It owns active-elsewhere routing for NOOK-072's thread-follow alerts.

**Acceptance.**
1. one mention is held by a quiet schedule, one by an item snooze and one while the member is active on desktop; each is released and delivered, and a fourth, held by quiet time, is canceled by a read. After the queue's thirty-day pruning, the member's readable export and a restored backup still list all four with their hold reasons, release times and outcomes, and erasing the sender removes all four. Set "Always send to mobile, even when I'm active" for one phone only: it alerts while the member is active on desktop, and a second phone stays held. A heartbeat replayed from a revoked session holds nothing. In the NOOK-097 500-event delivery-bar run with desktops active for part of the window, held events appear as `held-active-elsewhere` or are timed from release, and none is counted as displayed or silently missing.

#### NOOK-074 — Discover and verify a native installation

*Tier:* Core · *From:* NOOK-074

**Requirement.** Each Nook installation is its own service, so every native client first learns which installation it belongs to and then signs in the device that asked; no path signs in a different browser or device than the requester, and none falls back to another installation. Finding the installation: every invitation, join confirmation (NOOK-018) and cutover invitation (NOOK-041, NOOK-104, NOOK-076) email carries an open-in-app link and a QR code that both encode the installation's address. On a phone with the app installed they open the app already pointed at the installation; without the app they open its App Store or Play Store listing, and the first launch after install opens with that installation preselected (the store referrer on Android, the verified link reopened from the same email or QR on iOS), never chosen by guessing. The app and the desktop apps also accept a typed installation address. Every address, however it arrives, is checked over HTTPS against the installation's published descriptor at the published signed installation descriptor (installation ID, display name, icon, enabled sign-in methods and minimum client version), signed by the installation's key, and that key is pinned on first connection. An invalid certificate, a missing, unsigned or mismatched descriptor, an unreachable host or a site that is not a Nook installation shows an explicit error naming the address and connects nowhere; a later key change for an installation already added asks the member to confirm it as if it were new.

**Acceptance.**
1. A freshly invited member opens the invitation on a laptop and scans its QR code with an iPhone that does not have the app: the App Store listing opens, and after install the app opens with the installation preselected.
2. A mistyped installation address or mismatched descriptor shows the address in an error and connects nowhere; a changed pinned key needs fresh confirmation.

#### NOOK-125 — Managed native app deployment

*Tier:* Core · *From:* NOOK-074 · *Rules:* D-1

**Requirement.** Managed deployment: signed MSI and MSIX packages for Windows (Intune, Group Policy), a signed PKG for macOS (Jamf, Kandji, Intune), .deb and .rpm packages for Linux, and iOS and Android managed app configuration (AppConfig keys through any MDM) let IT preset the installation address, lock the app to it, disable adding other workspaces and choose the update channel. A preset address is still verified against the descriptor.

**Acceptance.**
1. A Windows MSI deployed through Intune and an iPhone with managed app configuration open locked to the verified installation, with adding workspaces and update channel governed by that configuration.

#### NOOK-126 — Device-bound email codes and app links

*Tier:* Core · *From:* NOOK-074

**Requirement.** Email code on any device: every sign-in email carries a one-time 6-character code beside the magic link. The code belongs to the pending sign-in that one device started, so typing it into that app or browser signs in that device only. It is single-use, valid for 10 minutes, refused on any other device or browser, invalidated when its link is used or a newer code is requested, stored hashed, and rate-limited per pending sign-in, address and client IP, with an audited lockout (NOOK-051) after 5 wrong entries. Universal links and app links: sign-in, invitation and permalink URLs are served from the installation's own domain with the platform-verified link associations (or the published descriptor, for installations whose domain the app does not yet know), so that on iOS and Android with the app installed a tapped sign-in link opens the Nook app as a verified universal link or Android App Link and completes the app's own pending sign-in, creating no browser session. A link opened on a device other than the one that requested it shows that request's device and the 6-character code to type there, and signs in the current browser only if the member explicitly chooses that instead.

**Acceptance.**
1. The member requests sign-in from the phone; the email arrives on the laptop, and typing its code into the phone signs the phone in.
2. Reusing the code, using it after 10 minutes or typing it into a third device is refused, and 5 wrong codes lock out with an audit entry.
3. Clicking that email's link on the laptop instead shows that the iPhone requested it, with the code, and signs the laptop browser in only after the member chooses that explicitly.
4. On an Android phone with the app installed, tapping the magic link in Gmail opens the Nook app signed in, and no browser session is created.

#### NOOK-127 — Desktop-to-mobile QR sign-in

*Tier:* Core · *From:* NOOK-074

**Requirement.** Sign in on mobile from desktop: a signed-in desktop or web client offers "Sign in on mobile", showing a single-use QR code valid for 60 seconds. The phone app scans it, the desktop shows "Sign in iPhone (Jane's)?" with the phone's device name, OS and approximate location, and only after that confirmation does the phone receive its own new session with its own token, never a copy of the desktop session. That session still meets NOOK-069 second-factor policy, is listed in the NOOK-115 sessions list with method `qr-from-desktop`, and is audited. A rescanned, expired, declined or other-installation code is refused, and owners can switch this method off.

**Acceptance.**
1. A member signed in on the macOS app chooses "Sign in on mobile"; the Android app scans the QR code and the desktop confirms the named phone.
2. The phone is signed in with its own session, listed in NOOK-115 sessions as `qr-from-desktop`, and signing out the desktop leaves the phone signed in.
3. Rescanning the same code, or scanning it after 60 seconds, is refused.

#### NOOK-128 — Native provider and factor sign-in

*Tier:* Core · *From:* NOOK-074 · *Register:* R-5

**Requirement.** Personal sign-in providers: owners may enable Continue with Google, Microsoft or Apple without configuring organization SSO. The provider's verified email must exactly match an existing member's confirmed mailbox, a pending invitation's address, or an approved domain under NOOK-018, so it is one more way to confirm a mailbox and never a fifth join door; an Apple private-relay address matches only an address already recorded for that member. SSO and passkeys in native apps: under NOOK-037 enforced SSO, native apps sign in through the IdP in the system authentication browser (ASWebAuthenticationSession on iOS and macOS, Custom Tabs on Android, the default browser with a claimed HTTPS or loopback redirect on Windows and Linux) using PKCE (S256) and state, never an embedded web view. While SSO is enforced, email codes, magic links and personal providers are disabled apart from NOOK-037's audited recovery route, and QR sign-in stays available only when the owner allows it, with the phone session bound to the IdP session policy. Enrolled members can sign in with a platform passkey (NOOK-069) on every native client. Second factor and lifecycle: every path above yields at most a NOOK-069 pending session when a second factor is required; deactivation (NOOK-018), session sign-out (NOOK-115) and SCIM offboarding (NOOK-037) end native sessions the same way. After first sign-in the device continues to NOOK-096's notification permission step. Its native workspace picker is the native half of NOOK-137's workspace switching.

**Acceptance.**
1. With 2FA enforced every native route reaches only second-factor entry or enrollment. With SSO enforced, iOS signs in through run-auth in the system browser with PKCE and email-code/magic-link options are absent.
2. With personal Google sign-in enabled, a matching confirmed mailbox signs in and an unknown address creates no account.

#### NOOK-075 — External-participant membership

*Tier:* Core · *From:* NOOK-075 · *Rules:* D-1

**Requirement.** A shared channel or external DM (NOOK-031) can invite by email a person whose organization runs no Nook installation, the way Slack invites people outside Slack to try Slack Connect. That person joins our installation as an *external participant*: they confirm their own mailbox through a NOOK-074, NOOK-126, NOOK-128 path (email code, link, passkey or personal provider; never an invitation link or approved-domain join), and every client shows them with the external indicator and the organization name the inviter entered, marked unverified unless their mailbox domain matches it. They can open only the channels and DMs they were invited to. They are never in our directory, people search, channel browser, default channels or user groups; they receive `@channel`/`@here` (NOOK-065) only in the conversations they share, can start DMs only with members who share a conversation with them and only where our NOOK-031 policy allows external DMs, and cannot create channels, install apps or invite anyone. Our organization's NOOK-031 policy governs them exactly as for a Nook-to-Nook shared channel: retention, export, media and calls, apps, NOOK-061 file policy and NOOK-040 labels and DLP, with our retention banner shown to them. An owner policy, shown before anyone is invited, states which roles may invite external participants, whether each invitation needs admin approval, an invitation expiry (default 14 days), whether NOOK-069 second factors are required of them, and whether such people are created as external participants (the default) or as NOOK-018 single-channel guests. External participants use the web and native clients (NOOK-021, NOOK-074, NOOK-126, NOOK-128), with their own notification choices (NOOK-032). Removing one from a conversation, or disconnecting their organization in one action that covers every participant carrying that organization name, ends access on every client, search, push and API at the next request, and the audit (NOOK-051) records who invited, approved, removed and disconnected. Their content follows our retention, holds and ERASURE-001.

**Acceptance.**
1. In our installation, invite `ana@acme.example`, whose organization runs no Nook, to the shared channel `#acme-project` and to an external DM.
2. She confirms her mailbox with a code in the iOS app and sees only `#acme-project` and that DM, with our retention banner; our members see her with the external badge and "Acme (unverified)".
3. She cannot browse channels, find anyone in the directory or people search, open `#vendor-print`, a default channel or any other DM, start a DM with a member she shares nothing with, create a channel or invite anyone, and each attempt is refused by the API as well as hidden in the client.
4. `@channel` in `#acme-project` reaches her; `@here` in `#general` does not.
5. Sharing a file labeled Confidential (NOOK-040) into `#acme-project` is blocked by DLP.
6. She posts, and our members get the reply under their ordinary NOOK-032, NOOK-100 levels on phone and desktop.
7. With the policy set to require admin approval, a member's invitation waits for an admin; with it set to guests, the next invitation creates a single-channel guest instead.
8. Remove Ana: her web, iOS and API sessions lose `#acme-project` and the DM at their next request and push stops. Invite two more Acme people, then disconnect Acme: all of them lose access on every client and API, and the audit shows each step.

#### NOOK-129 — External-participant home migration

*Tier:* Core · *From:* NOOK-075 · *Rules:* D-1

**Requirement.** If that organization later runs its own Nook, a mutually approved NOOK-031 connection takes over the conversation: each external participant confirms the same mailbox on their home installation, their authorship and the conversation's history and audience carry over unchanged, and their external-participant account on our installation is retired.

**Acceptance.**
1. After Acme starts Nook and both organizations approve the connection, Ana confirms the same mailbox there; history, audience and authorship carry over and the local external account retires.

#### NOOK-076 — Slack Connect preview and dispositions

*Tier:* Core · *From:* NOOK-076 · *Rules:* D-1 · *Register:* R-8

**Requirement.** Cutover from Slack (NOOK-041) never leaves a Slack Connect conversation silently behind. Preview: the cutover preview lists every Slack Connect channel and external DM found in the export (shared channels and messages whose `user_team` or `source_team` differs from the exporting workspace, with embedded `user_profile` data), the owner's approved source grant (`conversations.list` with `is_ext_shared`, `conversations.members`, `users.info`, `team.info`) and each consenting member's grant for private Connect channels and external DMs. Each row shows the channel or DM, every external organization (Slack team ID and name), its participants (Slack user ID, name, and email where Slack supplies it, otherwise marked as missing) and the last-activity date and imported message count. Disposition per external organization and conversation: the owner chooses (a) invite those people as NOOK-075 external participants in one reviewed action, with an editable cutover message and the NOOK-104 cutover time; a participant without a Slack-supplied email stays pending until the owner enters an address, which is recorded as owner-entered and is never guessed; (b) invite a partner organization that runs Nook to a NOOK-031 shared channel by its installation address (NOOK-074 descriptor), the imported channel becoming that shared channel once both sides approve; or (c) leave it in Slack with a recorded reason. Optionally, through the owner's grant with `chat:write`, Nook posts the cutover message into the Slack Connect channel so the partner sees where the conversation moved.

**Acceptance.**
1. Import a Slack Pro workspace with two Slack Connect channels (`#acme-project` with 3 Acme people, `#vendor-print` with 1 vendor person whose email Slack does not supply) and one external DM with a third organization.
2. The preview lists all three organizations, all five external people with their Slack user IDs and the missing vendor email, the external DM and each last-activity date.
3. Choose invite for Acme and the vendor (entering the vendor's address, shown as owner-entered), and leave-in-Slack for the DM with the reason "client prefers Slack"; send at the cutover time with the Slack-side cutover message posted into both channels.
4. An Acme person with no Nook installation confirms their mailbox and sees only `#acme-project`, with its imported history attributed to them through the Slack-user-ID mapping, the external badge on our side and our retention banner; they cannot browse channels, see our directory, or open `#vendor-print` or any DM.

#### NOOK-130 — Slack Connect history and identity cutover

*Tier:* Core · *From:* NOOK-076 · *Rules:* D-1

**Requirement.** History and identity: Slack Connect history imports under NOOK-041's rules, with external authors as imported identities carrying their organization and the external indicator. Accepting an invitation claims that person's imported authorship through the Slack-user-ID mapping recorded on the invitation, never by display name or email collision. An external participant is granted only the channels and DMs that were shared with their organization in Slack, with each channel's imported history as their organization could read it there (from their organization's first recorded join where the source records it); no external participant ever gains a channel, DM, message or file that was not shared with their organization in Slack. Report: the NOOK-104 cutover report shows, per external organization and per conversation, invited, joined, pending, bounced and left-in-Slack counts with reasons, resends pending invitations in one action, and keeps the cutover checklist open with "external conversations unresolved" until every Slack Connect conversation has a disposition; no external channel is silently dropped. Catch-up: NOOK-077 delta passes include Slack Connect conversations; their new messages, edits and deletions import under NOOK-077, and a Slack Connect channel, external DM or external participant first found by a later pass enters this preview and needs a disposition before the checklist closes.

**Acceptance.**
1. They post, and our members get the reply under ordinary NOOK-032, NOOK-100 levels on phone and desktop.
2. Removing them, or disconnecting Acme, revokes access on every client and API.
3. The cutover report lists Acme 3 of 3 joined, the vendor 0 of 1 pending with one-action resend, and the DM as left in Slack with its reason, and the checklist closes only once every Slack Connect conversation has a disposition.
4. A second run where a partner runs Nook invites it by installation address, and after both approve, the imported channel becomes a NOOK-031 shared channel with history intact. A message the Acme partner posts in Slack after the first import arrives with the NOOK-077 final pass, attributed through the same Slack-user-ID mapping.

#### NOOK-077 — Final catch-up import at cutover

*Tier:* Core · *Rules:* D-1, D-2

**Requirement.** A staged Slack cutover loses nothing posted in Slack between the first import and the switch. Delta passes: after a first NOOK-041 import, the owner runs one or more delta passes, each drawing on a later official export ZIP (any export date range, overlapping the earlier one or not). For every imported conversation and every newly found one, a pass reads from that conversation's watermark (its latest imported Slack `ts`) less an overlap window (default 7 days, owner-adjustable up to the conversation's full history), and re-reads replies in the export for every imported thread whose the latest reply time is later than the watermark, so replies to old imported threads are never missed. What a pass adds: new channels, DMs and group DMs (each through NOOK-041's audience rules and consent), new root messages, new replies in already-imported threads, reactions, pins, file bytes under NOOK-041's file rules, and new Slack members, who join the cutover invitation preview for the owner's review. A member deactivated in Slack since the first import is flagged to the owner, and their pending invitation is withdrawn only by the owner's choice. Deduplication: every record is keyed by its Slack source identity (workspace, conversation and `ts`; file ID), so re-running a pass, or overlapping export reads, adds nothing. Changes in Slack: an edit made in Slack to an already-imported message (a changed `edited.ts` or text) becomes a new imported revision with provenance (source, pass and Slack edit time), and the earlier imported revision stays in its history; reactions on imported messages follow Slack's latest re-read set. A message absent from a re-read that the source proves complete for that range is tombstoned under NOOK-002 with provenance `deleted-in-slack`, removing its body from live revisions. A conversation or range that no source in the pass can re-read completely (no export coverage) is reported `unverified` with its reason and the time it was last verified, and its imported messages are never tombstoned or changed on a guess. Native activity is never overwritten: Nook-native messages, replies, reactions (including those on imported messages, kept alongside Slack's), pins, saves, follows, read state, decisions and commitments are untouched by a pass; a decision or commitment citing an imported message that Slack later deleted keeps its own text and shows its source as deleted in Slack. Imported and native replies in one thread show in timestamp order, with native ones marked as posted in Nook. Inert: delta history creates no unread, Attention item, notification, automatic follow (NOOK-072), keyword hit, bot or workflow run, or accepted work, exactly like the first import; clients receive it through ordinary replay (NOOK-011) as history. NOOK-041's guarded batch undo applies per pass, removing only that pass's additions and revisions and never native activity. Report: every imported conversation shows "Slack history imported through <date and time, time zone>" (its latest completely verified read), and the cutover report states the workspace-wide figure with per-pass counts of added, revised, tombstoned, unverified and skipped records, each skip with its reason.

**Acceptance.**
1. Friday export imported; Monday export holds a new root, a reply to an imported thread, an edited and a deleted message, a reaction, a new channel, a new DM and a new member; native replies posted in between; run the pass: each change once, edit as new revision, deleted tombstoned only for a proven-complete range, DM only to its two members, no alerts/unread/follows, native items unchanged; rerun adds nothing; a range the export does not cover is `unverified`; undo removes only the pass's additions.
2. An optional owner-stated date range on the shared first-import/delta plan door is recorded in existing pass history as “attested, not verified”, with the current owner and server recording time.
3. Dates must be real past UTC calendar dates, bounded by the Unix epoch and the import day, from before to; invalid ranges are refused visibly.
4. The statement changes no coverage, imported-through or last-verified value, pass count or deletion authority: absent messages remain retained and their range unverified.
5. Guarded undo removes it with the pass; the owner’s readable export and operational archive carry it, restore resumes no sends, and existing pass erasure withdraws it.

#### NOOK-078 — Store-app push registration

*Tier:* Core · *From:* NOOK-078 · *Register:* R-2

**Requirement.** Every customer installation, on its own Cloudflare account, pushes to the store-published iOS and Android apps without holding Apple's or Google's signing credentials. Named push path: the publisher (just-every) operates the Nook Push Gateway, which holds the store apps' APNs auth key (alert and PushKit VoIP topics) and FCM service account. Setup generates a per-installation Ed25519 key, registers its public half with the gateway against the installation's NOOK-074 descriptor (the gateway confirms that the installation's the published signed installation descriptor names the same key), and signs every push request with it. The device token travels with each request, and the gateway keeps no device-token registry. Doctor and the admin health view show the registration state, the key fingerprint and the last gateway acknowledgment time.

**Acceptance.**
1. Install Nook on a fresh Cloudflare account that is not the publisher's, run setup and see the gateway registration, key fingerprint and last acknowledgment in doctor.
2. Sign the store-published iOS and Android apps in through NOOK-074 and run NOOK-097's 500-event delivery-bar journey from that installation: it meets the bar.

#### NOOK-131 — Push gateway confidentiality and disclosure

*Tier:* Core · *From:* NOOK-078 · *Rules:* D-1 · *Register:* R-7

**Requirement.** What the gateway sees: only the device token, installation ID, an opaque delivery ID, timing, push type, priority, TTL, collapse identifier and the encrypted packet's size. NOOK-062's per-device encryption, badge count included, is applied before a request leaves the installation, and the visible fallback text APNs and FCM need when a device cannot decrypt is the fixed `generic` wording, so no message text, sender or conversation name, file name or badge count reaches the gateway, APNs or FCM. The gateway logs no per-message record beyond per-installation rate counters and delivery-result counts kept at most 72 hours, then only daily aggregate counts per installation. Disclosure (NOOK-050): the gateway is on the published subprocessor list with its region (US, on the publisher's Cloudflare account, with transient request processing at Cloudflare's edge stated), its published availability objective (99.95% monthly, measured and published), its price (included at USD 0 for every installation, with no per-member or per-installation fee) and its terms: at least 12 months' public notice before any price change or discontinuation, with owner-credential mode available throughout.

**Acceptance.**
1. Capture every request the gateway receives during the run: none contains message text, a sender or conversation name, a file name or a badge count.
2. The published subprocessor list names the gateway with its region, availability objective, price and terms.

#### NOOK-132 — Native push failure and registration recovery

*Tier:* Core · *From:* NOOK-078

**Requirement.** Acknowledgments and failure handling: the gateway returns APNs's and FCM's own result (accepted with the provider's ID, or the provider's error) to the installation. A stale token (APNs `Unregistered` or `BadDeviceToken`, FCM `UNREGISTERED`) retires that device under NOOK-021's repair rules. A gateway refusal, rate limit or outage is recorded as `provider-unconfirmed` with reason `gateway` in the member's device delivery view and the owner's delivery report (NOOK-048), never as a silent miss, and doctor and the admin health view (NOOK-107) show a named dependency outage. Queued pushes retry with the same delivery ID within each event's TTL, and the apps display each delivery ID at most once, so recovery creates no duplicates; an event whose TTL lapses (a call invite after 30 seconds) stays `provider-unconfirmed`. Revocation: the owner can revoke or rotate the installation's gateway registration from setup. The publisher may suspend a registration only for abuse under its published acceptable-use terms, with the reason shown in doctor. A revoked or suspended registration sends nothing and doctor says why.

**Acceptance.**
1. Block the gateway for 10 minutes during the run: the affected events are recorded as `provider-unconfirmed` with reason `gateway`; the owner report, the admin health view and doctor name the gateway outage; when the block lifts, delivery resumes with no event displayed twice; and a call invite whose 30-second TTL lapsed stays `provider-unconfirmed`.
2. Uninstall the app on one phone and see its token retired.
3. Revoke the installation's gateway registration: pushes stop and doctor says why; re-register and they resume.

#### NOOK-133 — Owner-credential native push

*Tier:* Core · *From:* NOOK-078

**Requirement.** Owner-credential mode: an owner who wants no publisher in the push path builds the iOS and Android apps from the published build instructions under their own bundle ID and Firebase project, signs them with their own Apple Developer and Google Play accounts and distributes them (Apple Business Manager custom app, managed Google Play private app or MDM) with the installation address preset. Setup accepts their APNs `.p8` key (key ID, team ID and bundle ID) and FCM service-account JSON, stores them encrypted like other provider secrets and verifies each before saving: APNs must answer a probe with `BadDeviceToken` rather than `InvalidProviderToken`, and FCM must accept a `validate_only` send. The installation then sends to APNs and FCM directly, with the same encryption, acknowledgments and failure accounting. Desktop apps receive over their own authenticated connection to the installation and the web/PWA through NOOK-015's VAPID Web Push, so neither depends on the gateway. NOOK-072's native device receipt is measured here.

**Acceptance.**
1. Repeat a reduced 50-event journey in owner-credential mode with apps self-built and signed by the buyer's own Apple and Google accounts: setup rejects a wrong `.p8` key and accepts the right one, and a capture shows no request reaching the gateway.

#### NOOK-079 — Scoped integration tokens

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-AGENT-004, BASE-AGENT-005 · *Rules:* D-1

**Requirement.** Scoped integration credentials let another service post to one to twenty of the creating owner's channels, without a person's session cookie or any DM scope. Owner creation shows the secret once and retains only a protected hash. Posts use a token-scoped client key: replay returns one original message and a changed body conflicts. Current owner role, membership, posting policy and text limits remain necessary. Rotation ends the old secret while preserving identity and retry keys; revocation or installation key rotation ends access. Activity shows the named service credential and creating owner truthfully. Archives retain activity and via-labels, with no credential or binding restored. Accountable agent authority instead uses NOOK-054's sponsor-bound door; a service credential conveys none. [Credential protocol](docs/contract/mechanism.md#nook-079) records wire formats and refusal codes.

**Acceptance.**
1. At 1440 and 390 an owner creates a token for one channel and copies it once; a script posts with it twice under one idempotency key and one message appears, labeled via the token.
2. The same token is refused for another channel, any other route and a request trying to use a service credential as accountable agent authority.
3. After rotation the old token is refused and the new one replays the key to the same message; after revocation it is refused.
4. The owner sees every action and refusal, the database holds only a sealed hash, and a restored archive carries the activity but no token.

#### NOOK-080 — Notification destination door

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001 · *Rules:* D-1

**Requirement.** An owner or admin approves a notifying app (a sibling such as Slate, or any `NOOK-025` app) for named channels only, issuing a channel-scoped token shown once, stored hashed, revocable by owner, admin or channel manager. Posts are authenticated, idempotent on a client key, limited to 1 per second per channel (burst 20) with `429` and `Retry-After`, and editable only by the posting app. For approved channels only, the token reads: privacy, sharing (`NOOK-031`), and members with verified email, guest flag and bot flag. After revocation, archive, sharing or removal, posts write nothing. Messages show the app identity and badge, and are audited (`NOOK-051`) and exported (`NOOK-047`).

**Acceptance.**
1. Approve an app for one private channel.
2. Post, edit and delete; replay a key; exceed the rate; read every audience fact.
3. Then add a guest, share, archive and revoke: facts change and later posts write nothing.
4. Channel A's token cannot reach channel B.
5. Several approved channels receive separate credentials; replacing an app-name/channel approval revokes the old approval.
6. App writes keep literal broadcast spelling rather than representing a person’s confirmation. Current posting and import-publication policy fences every create, edit and delete.
7. A receipt stays identical after edits; erased intents do not resurrect content. Restored approvals have no token, rate counter or mailbox proof and need reissue.


### Honest boundaries and external custody

#### NOOK-081 — Inbound email into conversations

*Tier:* Core · *Rules:* D-1

**Requirement.** Channels can also have a revocable inbound email address: forwarded email posts as an attributed "Email" message with sender, subject, sanitized text and attachments (scanned under NOOK-110), with optional sender allow-listing and spam limits, and never creates accepted work.

**Acceptance.**
1. Email a PDF to a channel's address and see one attributed post; with allow-listing on, an unlisted sender is refused.

#### NOOK-082 — Scheduled forwarding

*Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-1

**Requirement.** From any message on every client, a member forwards to one or more channels, DMs, group DMs or a thread, with an optional note and optional scheduled time (NOOK-034). RL-2 governs delivery revalidation. Native clients inherit this forward door; shared external forwarding remains NOOK-083 with NOOK-031.

**Acceptance.**
1. Forward once at the optional scheduled time, with or without a note; edit and cancel pending times.
2. At delivery recheck the approving session, access generation, source, owner policy and posting permission for each destination. A refused destination sends nothing and shows its individual reason; the authorized subset commits atomically.
3. Never silently downgrade Show message. Restore pauses schedules and discards approving-session authority.
4. Keep no pending source body or file snapshot before delivery; source erasure cancels and strips the request and sender erasure removes it.

#### NOOK-083 — External shared-channel forwarding

*Tier:* Core · *Rules:* D-1

**Requirement.** Forwarding needs posting permission in each destination (NOOK-066), and forwarding into an external shared channel needs both organizations' policies (NOOK-031).

**Acceptance.**
1. Forwarding into an external shared channel needs both organizations' policies.

#### NOOK-084 — Scheduled catch-up digests

*Tier:* Core · *Cites:* BASE-DATA-004, BASE-AGENT-007 · *Rules:* D-1

**Requirement.** Daily or weekly unread digests use the member's own selected in-app or email-link delivery, never an owner's opt-in for someone else. Access and quiet time are recomputed before delivery and display; next-run opt-out and cancel apply while an already-delivering occurrence may finish. The owner-enabled provider path is bounded and shares the published cost control; exhausted calls are skipped with a recipient-only content-free reason, without a queued retry. Source-only receipts keep no answer cache or embeddings. Restore disables schedules, member erasure removes in-flight work, and corrections/dismissals keep private attribution and custody. Shared/external channels are excluded pending their delivery capability, without closing that target. RL-3 records the digest ruling; [Digest mechanism](docs/contract/mechanism.md#nook-084) retains provider bounds and source-only state.

**Acceptance.**
1. Approve a daily unread digest schedule over contradictory discussions and inaccessible channels; check every factual point against a source link; remove access before delivery; correct a claim and cancel the schedule; no private snippet or invented acceptance survives; approve, cancel, quiet-time deferral, access removed before delivery sends nothing.

#### NOOK-085 — Call recordings and consent artifacts

*Tier:* Core

**Requirement.** Call recordings, consent records and transcripts remain scoped private files with retention, export and hold policy.

**Acceptance.**
1. Record a consented huddle and inspect its audience.
2. Reject an outsider, simulate failed processing, correct a transcript and export/delete or hold the artifact without losing policy state.

#### NOOK-086 — Suggested AI clip summaries

*Tier:* Core

**Requirement.** Users may correct transcript text with history; AI summaries cite timestamps and carry stated uncertainty; the company's policy decides whether a standard filing or commitment action uses them.

**Acceptance.**
1. AI summaries cite timestamps and carry stated uncertainty; the company's policy decides whether a standard filing or commitment action uses them.

#### NOOK-087 — Provider-generated transcripts

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004 · *Register:* R-10

**Requirement.** Call recordings, consent records and transcripts remain scoped private files with retention, export and hold policy. Provider-generated transcript requests use the owner-configured provider; the provider is disclosed before audio leaves the installation, and returned cues enter the versioned private transcript. The reproducible provider fixture gates acceptance; live-provider receipts are recorded in R-10. RL-8 records the carried policy decision. The clip author and owners or admins who can currently read it may request transcription; wider member requests are a separate owner-controlled capability. The request binds the disclosed provider version and rechecks source authority before audio leaves; a returned transcript appends only if no human revision arrived meanwhile.

**Acceptance.**
1. Reject an outsider, simulate failed processing, correct a transcript and export/delete or hold the artifact without losing policy state.

#### NOOK-088 — Slack grant and app delta reads

*Tier:* Core · *Rules:* D-1, D-2 · *Register:* R-8

**Requirement.** A staged Slack cutover loses nothing posted in Slack between the first import and the switch. Delta passes: after a first NOOK-041 import, the owner runs one or more delta passes, each drawing on any of a later official export ZIP (any export date range, overlapping the earlier one or not), the owner's approved source grant and each consenting member's NOOK-103 grant. For every imported conversation and every newly found one, a pass reads from that conversation's watermark (its latest imported Slack `ts`) less an overlap window (default 7 days, owner-adjustable up to the conversation's full history), and re-reads thread-reply reads for every imported thread whose the latest reply time is later than the watermark, so replies to old imported threads are never missed. Reads go through a Slack app that is Marketplace-approved or created in the buyer's own workspace from Nook's published app manifest as an internal app, so Slack's reduced conversation-history reads/thread-reply reads limits for non-Marketplace distributed apps never throttle a pass; the preview estimates each pass's duration from the measured request rate before the owner schedules it. What a pass adds: new channels, DMs and group DMs (each through NOOK-041's audience rules and consent, and Slack Connect conversations through NOOK-076's dispositions), new root messages, new replies in already-imported threads, reactions, pins, file bytes under NOOK-041's file rules, and new Slack members, who join the cutover invitation preview for the owner's review. Deduplication: every record is keyed by its Slack source identity (workspace, conversation and `ts`; file ID), so re-running a pass, or overlapping export and grant reads, adds nothing. A message absent from a re-read that the source proves complete for that range (paged to its end without error) is tombstoned under NOOK-002 with provenance `deleted-in-slack`, removing its body from live revisions. A conversation or range that no source in the pass can re-read completely (no export coverage, no grant, a revoked grant or a Slack error) is reported `unverified` with its reason and the time it was last verified, and its imported messages are never tombstoned or changed on a guess. Report and one-action switch: every imported conversation shows "Slack history imported through <date and time, time zone>" (its latest completely verified read), and the cutover report states the workspace-wide figure with per-pass counts of added, revised, tombstoned, unverified and skipped records, each skip with its reason. The owner schedules the final pass for the cutover time, and that one scheduled action, surviving restart, runs the final pass and then sends the NOOK-104 invitations and the optional NOOK-076 Slack-side cutover message. If the final pass fails, the invitations wait and the owner sees why, then chooses to retry or to send anyway with the uncovered period stated in the report.

**Acceptance.**
1. Import a Friday export of a Slack Pro test workspace, with member grants for its private channels and DMs.
2. Over the weekend in Slack, post a new root message and a reply to an imported thread, edit one imported message, delete another, add a reaction, create a channel, start a new DM between two consenting members, add a member and create a Slack Connect channel with a partner.
3. On Monday morning, before the delta pass, post native Nook replies in one imported thread.
4. Run the final delta pass at the scheduled cutover time: each Slack change appears exactly once; the edit shows as a new imported revision with the earlier one in its history; the deleted message is tombstoned; the reaction, the new channel and the DM are present, and the DM is visible only to its two members; the new member appears in the invitation preview and is invited; the thread interleaves imported and native replies in time order with native ones marked; no one receives an alert, unread, Attention item or follow for imported items; and every native item is unchanged.
5. The new Slack Connect channel appears in the NOOK-076 preview and keeps the checklist open until it has a disposition.
6. Run the same pass again: it adds nothing.
7. Revoke the grant covering one private channel and delete a message there in Slack: the next pass counts that channel as `unverified` with its reason and leaves the imported message intact.
8. Force a Slack error during a scheduled final pass: the invitations wait and the owner sees the failure. The cutover report shows "imported through" the cutover time with per-pass counts, and undoing the last pass removes only its additions and revisions while the native replies remain.

#### NOOK-089 — Notification destination door extension

*Tier:* Core · *Rules:* D-1

**Requirement.** This clause only extends NOOK-080 with three parts: thread field — the approved app’s channel-scoped token can name a thread in its approved channel and post into that thread under NOOK-066; client-key lookup — looking up a given client key returns the accepted receipt without a second post; replacement-approval edit — after replacement approval for the same app name and channel, that same app identity can edit its earlier post, and no other app can. It adds no further capability and changes nothing about tokens, rate limits or revocation.

**Acceptance.**
1. Approve a notifying app for one private channel, post into that channel’s thread by naming the thread, lose the reply and look up the client key: one accepted receipt is returned and no second post is created.
2. Reapprove the same app name and channel, then use the replacement approval to edit that app’s earlier post; another app is refused.
3. The app identity is the exact app-name/channel approval pair under RL-1; no other pair or revoked token edits earlier posts, and current channel authority still applies.
4. Each edit is attributed to that app identity in the authority trail.
5. Client-key lookup returns the original body-free acceptance receipt, or an explicit non-acceptance/tombstone state; it creates no second effect.


### Personal workspace capabilities

#### NOOK-134 — Custom profile fields and people directory

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** Admins define custom profile fields (title, department, phone, manager, location, pronouns, start date) with per-field visibility. A searchable people directory filters by name and those fields, pages completely at NOOK-049 capacity, honors guest scope and never exposes a hidden field.

**Acceptance.**
1. Define title, phone and manager fields, fill them and find a person by department in the people directory at 1440 and 390; a guest sees only people in their granted channels and no hidden field.

#### NOOK-135 — Private draft state

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** Private drafts survive navigation and account-isolated restart; editing, pending send and failed send are distinct states. Drafts stay separate when a person switches accounts or workspaces. Native draft resumption belongs to NOOK-021.

**Acceptance.**
1. Leave and resume a draft on each supported client, across navigation and restart.
2. Switch accounts and workspaces and inspect draft isolation.

#### NOOK-136 — Personal sidebar organization

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** People organize channel and DM sections in their own sidebar and mark conversations unread without changing work acceptance.

**Acceptance.**
1. Organize channel and DM sections and mark a conversation unread; work acceptance stays unchanged.

#### NOOK-137 — Device-held workspace picker

*Tier:* Core · *From:* NOOK-017 · *Rules:* D-1

**Requirement.** On the web a member switches workspaces from a "Your workspaces" menu that lists the installations this browser has signed in to; the list is kept on the device, each entry opens that installation's own origin, any entry other than the current workspace can be removed (removing forgets it on this device and signs nothing out), and sign-in, drafts, caches and notifications stay separate per installation. Each installation records itself when this browser is signed in there; opening or adding another installation from the menu carries the list to it in the URL fragment, which no server receives, and an installation that list has never held joins only after the member confirms it. A native workspace picker is NOOK-074's and NOOK-021's.

**Acceptance.**
1. Switch accounts and workspaces; each installation retains its own drafts, cached state and notifications. A new installation joins the device list only after confirmation, and forgetting another installation signs nothing out.

### Agent surface

**Specialist: conversation clerk.** It keeps team discussion tied to decisions, accepted work and authorized source evidence.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

**How Nook computes each class.**
- standard: reversible internal messages, notes, follows and drafts, measured in items.
- external: new outside exposure through recipients, external participants, links or connectors; recipient count and known, new or public counterparty come from current records.
- commitment: accepted work, a business decision or sign-off; value and counterparty come from the bound record.
- access: membership, device, role or app-grant changes; people and widening/narrowing direction come from the change.
- security: factor, credential, scanning and protection settings, naming the changed setting.
- destructive: irreversible erasure or purge, with affected item count.
- sensitive: regulated personal fields and files labeled as holding them, with record count and data kind.
- money: a change to what the business pays, with amount, currency and counterparty.
- accounts: an outside account or paid resource, naming its provider.
- gated: the provider's hosted consent, verification or checkout step that it keeps for a person, naming provider and step.
- live: published workflows and changed running delivery behavior, naming the affected service.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `nook.nook_001.run` | Current identity and conversation membership (C1) | NOOK-001 | standard or access | not implemented as MCP |
| `nook.nook_002.run` | Atomic messages, retries and replay (C2) | NOOK-002 | standard | not implemented as MCP |
| `nook.nook_003.run` | Fixed DMs and channel membership (C3) | NOOK-003 | standard or access | not implemented as MCP |
| `nook.nook_004.run` | Decisions and commitments (C4) | NOOK-004 | standard or commitment | not implemented as MCP |
| `nook.nook_005.run` | Read cursors and attention (C5) | NOOK-005 | standard | not implemented as MCP |
| `nook.nook_007.run` | Safe rendering and local binding (C7) | NOOK-007 | standard or security | not implemented as MCP |
| `nook.nook_009.run` | Backup and export (C9) | NOOK-009 | standard or destructive | not implemented as MCP |
| `nook.nook_010.run` | Commitment revision and cancellation (C10) | NOOK-010 | standard or commitment | not implemented as MCP |
| `nook.nook_011.run` | Cached retries, synchronization and complete history (C11) | NOOK-011 | standard | not implemented as MCP |
| `nook.nook_012.run` | Private attachments (C12) | NOOK-012 | standard | not implemented as MCP |
| `nook.nook_013.run` | Calm attention (C13) | NOOK-013 | standard | not implemented as MCP |
| `nook.nook_014.run` | Email notifications (C14) | NOOK-014 | standard or external | not implemented as MCP |
| `nook.erasure.run` | Member, message and imported-author erasure | ERASURE-001 | standard or destructive | not implemented as MCP |
| `nook.nook_015.run` | Web Push (C15) | NOOK-015 | standard or external | not implemented as MCP |
| `nook.nook_016.run` | Everyday conversations | NOOK-016 | standard | not implemented as MCP |
| `nook.nook_017.run` | Composition and typed markup | NOOK-017 | standard | not implemented as MCP |
| `nook.nook_090.run` | Personal profile, status and presence | NOOK-090 | standard | not implemented as MCP |
| `nook.nook_134.run` | Custom profile fields and people directory | NOOK-134 | standard or access | not implemented as MCP |
| `nook.nook_136.run` | Personal sidebar organization | NOOK-136 | standard | not implemented as MCP |
| `nook.nook_091.run` | Built-in conversation commands | NOOK-091 | standard | not implemented as MCP |
| `nook.nook_092.run` | Drafts and sent messages view | NOOK-092 | standard | not implemented as MCP |
| `nook.nook_018.run` | Invitation and offboarding journeys | NOOK-018 | standard or access | not implemented as MCP |
| `nook.nook_093.run` | Bulk team invitations | NOOK-093 | standard or access | not implemented as MCP |
| `nook.nook_094.run` | Invitation links and requests | NOOK-094 | standard or access | not implemented as MCP |
| `nook.nook_095.run` | Verified-domain joining | NOOK-095 | standard or access | not implemented as MCP |
| `nook.nook_019.run` | Search conversations and files | NOOK-019 | standard or sensitive | not implemented as MCP |
| `nook.nook_020.run` | Saved items and channel pins | NOOK-020 | standard | not implemented as MCP |
| `nook.nook_022.run` | In-context voice, video and screen sharing | NOOK-022 | standard or external | not implemented as MCP |
| `nook.nook_023.run` | Zoom, Google Meet and Teams meetings | NOOK-023 | standard or external or accounts or gated | not implemented as MCP |
| `nook.nook_024.run` | Asynchronous clips, transcripts and call artifacts | NOOK-024 | standard or external or sensitive | not implemented as MCP |
| `nook.nook_025.run` | App platform and scoped event delivery | NOOK-025 | standard or access or accounts or commitment | not implemented as MCP |
| `nook.nook_098.run` | App direct messages and home | NOOK-098 | standard or access or external | not implemented as MCP |
| `nook.nook_099.run` | App channel management | NOOK-099 | standard or access | not implemented as MCP |
| `nook.nook_026.run` | Workflow builder and durable scheduled work | NOOK-026 | standard or commitment or live or external | not implemented as MCP |
| `nook.nook_027.run` | Engineering and project integrations | NOOK-027 | standard or external or gated or commitment | not implemented as MCP |
| `nook.nook_028.run` | Support, sales and operational signals | NOOK-028 | standard or external or gated | not implemented as MCP |
| `nook.nook_029.run` | Connected documents and knowledge | NOOK-029 | standard or external or gated | not implemented as MCP |
| `nook.nook_030.run` | Calendars, availability and meeting reminders | NOOK-030 | standard or external or accounts or gated | not implemented as MCP |
| `nook.nook_031.run` | Shared channels between organizations | NOOK-031 | standard or external | not implemented as MCP |
| `nook.nook_032.run` | Quiet schedules and personal keyword routing | NOOK-032 | standard | not implemented as MCP |
| `nook.nook_100.run` | Per-conversation notification levels | NOOK-100 | standard | not implemented as MCP |
| `nook.nook_101.run` | New-member notification choices | NOOK-101 | standard | not implemented as MCP |
| `nook.nook_033.run` | Personal and channel reminders | NOOK-033 | standard or external | not implemented as MCP |
| `nook.nook_034.run` | Scheduled and recurring messages | NOOK-034 | standard or external or live | not implemented as MCP |
| `nook.nook_035.run` | Channel recaps and catch-up digests | NOOK-035 | standard or external or sensitive | not implemented as MCP |
| `nook.nook_036.run` | AI search with cited answers | NOOK-036 | standard or external or sensitive | not implemented as MCP |
| `nook.nook_037.run` | SSO, SAML and lifecycle provisioning | NOOK-037 | standard or access or gated | not implemented as MCP |
| `nook.nook_038.run` | Retention, legal hold and preservation | NOOK-038 | standard or destructive | not implemented as MCP |
| `nook.nook_039.run` | Compliance search and controlled exports | NOOK-039 | standard or external or sensitive | not implemented as MCP |
| `nook.nook_040.run` | Information protection and data handling | NOOK-040 | standard or security or sensitive or external | not implemented as MCP |
| `nook.nook_104.run` | Slack cutover invitations | NOOK-104 | standard or access | not implemented as MCP |
| `nook.nook_047.run` | Readable portability and controlled exit | NOOK-047 | standard or sensitive | not implemented as MCP |
| `nook.nook_048.run` | Team administration and reporting | NOOK-048 | standard or sensitive | not implemented as MCP |
| `nook.nook_049.run` | Team capacity and complete directories | NOOK-049 | standard | not implemented as MCP |
| `nook.nook_107.run` | Component health and measured recovery | NOOK-107 | standard | not implemented as MCP |
| `nook.nook_051.run` | Auditable authority and actions | NOOK-051 | standard | not implemented as MCP |
| `nook.nook_053.run` | Conversation notes and lightweight lists | NOOK-053 | standard or sensitive | not implemented as MCP |
| `nook.nook_060.run` | Organization administration and delegated roles | NOOK-060 | standard or access or security or accounts or live or money | not implemented as MCP |
| `nook.nook_109.run` | Channel lifecycle and history disclosure | NOOK-109 | standard or access | not implemented as MCP |
| `nook.nook_061.run` | Large files, previews and admission policy | NOOK-061 | standard or destructive | not implemented as MCP |
| `nook.nook_110.run` | Malware scanning and quarantine | NOOK-110 | standard or security | not implemented as MCP |
| `nook.nook_062.run` | Private notification preview levels | NOOK-062 | standard | not implemented as MCP |
| `nook.nook_111.run` | Notification reply and mark-read actions | NOOK-111 | standard | not implemented as MCP |
| `nook.nook_063.run` | Slack-compatible incoming webhooks | NOOK-063 | standard | not implemented as MCP |
| `nook.nook_112.run` | Slack-compatible Web API | NOOK-112 | standard | not implemented as MCP |
| `nook.nook_113.run` | Slack event, command and interactive compatibility | NOOK-113 | standard | not implemented as MCP |
| `nook.nook_114.run` | Block formatting and compatibility disclosure | NOOK-114 | standard | not implemented as MCP |
| `nook.nook_064.run` | Zapier, Make and n8n connectors | NOOK-064 | standard or external or accounts or gated | not implemented as MCP |
| `nook.nook_065.run` | Channel-wide mentions: @channel, @here and @everyone | NOOK-065 | standard | not implemented as MCP |
| `nook.nook_066.run` | Channel posting permissions and announcement channels | NOOK-066 | standard | not implemented as MCP |
| `nook.nook_067.run` | Forwarding messages and email into conversations | NOOK-067 | standard or external | not implemented as MCP |
| `nook.nook_068.run` | Safe link previews and app unfurls | NOOK-068 | standard or external | not implemented as MCP |
| `nook.nook_069.run` | Organization second-factor enforcement | NOOK-069 | standard or security | not implemented as MCP |
| `nook.nook_115.run` | Own sessions and device revocation | NOOK-115 | standard or access | not implemented as MCP |
| `nook.nook_070.run` | Conversation polls | NOOK-070 | standard | not implemented as MCP |
| `nook.nook_116.run` | GIF search and posting | NOOK-116 | standard or external | not implemented as MCP |
| `nook.nook_117.run` | Thread replies also sent to channel | NOOK-117 | standard | not implemented as MCP |
| `nook.nook_118.run` | Channel bookmarks | NOOK-118 | standard | not implemented as MCP |
| `nook.nook_119.run` | On-request message translation | NOOK-119 | standard or external | not implemented as MCP |
| `nook.nook_071.run` | Followed Threads view | NOOK-071 | standard | not implemented as MCP |
| `nook.nook_120.run` | All unreads view | NOOK-120 | standard | not implemented as MCP |
| `nook.nook_121.run` | Group-DM conversion to private channel | NOOK-121 | standard or access | not implemented as MCP |
| `nook.nook_072.run` | Automatic thread follows | NOOK-072 | standard | not implemented as MCP |
| `nook.nook_122.run` | All replies and follow-source visibility | NOOK-122 | standard | not implemented as MCP |
| `nook.nook_123.run` | Mentions-only thread badge choice | NOOK-123 | standard | not implemented as MCP |
| `nook.nook_073.run` | Active-elsewhere alert routing | NOOK-073 | standard | not implemented as MCP |
| `nook.nook_124.run` | Device delivery history and routing custody | NOOK-124 | standard | not implemented as MCP |
| `nook.nook_075.run` | External-participant membership | NOOK-075 | standard or access | not implemented as MCP |
| `nook.nook_129.run` | External-participant home migration | NOOK-129 | standard or access | not implemented as MCP |
| `nook.nook_079.run` | Scoped integration tokens | NOOK-079 | standard or access or security | not implemented as MCP |
| `nook.nook_080.run` | Notification destination door | NOOK-080 | standard or access | not implemented as MCP |
| `nook.nook_081.run` | Inbound email into conversations | NOOK-081 | standard | not implemented as MCP |
| `nook.nook_082.run` | Scheduled forwarding | NOOK-082 | standard or external | not implemented as MCP |
| `nook.nook_083.run` | External shared-channel forwarding | NOOK-083 | standard or external | not implemented as MCP |
| `nook.nook_084.run` | Scheduled catch-up digests | NOOK-084 | standard or external | not implemented as MCP |
| `nook.nook_085.run` | Call recordings and consent artifacts | NOOK-085 | standard or sensitive | not implemented as MCP |
| `nook.nook_086.run` | Suggested AI clip summaries | NOOK-086 | standard or external or commitment | not implemented as MCP |
| `nook.nook_087.run` | Provider-generated transcripts | NOOK-087 | standard or external or sensitive | not implemented as MCP |
| `nook.nook_089.run` | Notification destination door extension | NOOK-089 | standard or access | not implemented as MCP |
| `nook.nook_054.run` | Scoped company-context agents and MCP | NOOK-054 | standard or access or security or external or commitment | not implemented as MCP |
| `nook.nook_055.run` | Accountable commitment assistant | NOOK-055 | standard or commitment | not implemented as MCP |
| `nook.nook_056.run` | Decisions that stay current | NOOK-056 | standard or commitment | not implemented as MCP |
| `nook.nook_057.run` | Calm follow-through across linked systems | NOOK-057 | standard or external | not implemented as MCP |
| `nook.nook_058.run` | Stale handoffs and proposed resolution | NOOK-058 | standard or commitment or external | not implemented as MCP |
| `nook.nook_059.run` | Visible and controllable agent execution | NOOK-059 | standard | not implemented as MCP |

**Resources.** `nook://conversations/{id}`, `nook://messages/{id}`, `nook://outcomes/{id}`, `nook://files/{id}`, `nook://notes/{id}`, `nook://schedules/{id}`, `nook://audit/{id}`.

**Events.** Message changed, decision revised, commitment proposed/accepted/reported, membership changed, notification outcome, schedule changed, and the inherited approval, review and policy events.

**Prompts.** Conversation recap (NOOK-035), commitment follow-through (NOOK-055, NOOK-057) and the seeded-week conversation clerk (SURFACE-006).

**Not tools, and why.**
- NOOK-135: private draft storage and resumption on the member’s device.
- NOOK-137: the device-held workspace list and cross-origin navigation screen.
- NOOK-006: offline restore through the import door.
- NOOK-008: release-measurement and installation facts.
- DOCS-001: the public documentation reader and build-time guide inventory.
- NOOK-021: signed native-client and device-only offline work.
- NOOK-096: device-only notification permission and display.
- NOOK-097: device-fleet measurement and installation facts.
- NOOK-042: the Teams import door.
- NOOK-043: the Google Chat import door.
- NOOK-044: the Campfire import door.
- NOOK-045: the Zulip import door.
- NOOK-046: the Mattermost import door.
- NOOK-041: the Slack ZIP import door.
- NOOK-102: the import-door integration census.
- NOOK-103: the source-connector and consent screens.
- NOOK-105: the Slack personal-settings connector.
- NOOK-106: the imported-link renderer.
- NOOK-050: deployment, jurisdiction and subprocessor installation facts.
- NOOK-108: published operating-cost measurements.
- NOOK-052: a person’s keyboard and assistive-technology screen.
- NOOK-074: device-only installation discovery.
- NOOK-125: managed device installation packages.
- NOOK-126: a person’s device-bound sign-in screen.
- NOOK-127: a person’s QR confirmation screen.
- NOOK-128: a person’s provider and second-factor screen.
- NOOK-076: the Slack Connect import preview.
- NOOK-130: the Slack Connect import-door identity cutover.
- NOOK-077: the ZIP delta import door.
- NOOK-088: the live Slack source connector.
- NOOK-078: device-only native push registration.
- NOOK-131: gateway installation facts and transport confidentiality.
- NOOK-132: native device and gateway transport recovery.
- NOOK-133: owner-built native application installation.

**Limits.** Request, body, byte, page and passage capacity bounds are in the [mechanism notes](docs/contract/mechanism.md); business thresholds and provider spend caps are the company’s policy.

**Handoffs.** Listen for authorized issue, support, document and incident events from the named connectors; emit cited conversation, decision and commitment events for the responsible specialist. A handoff carries source URIs and preserves the source audience.

#### SURFACE-001 — Conversation specialist registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-013

**Requirement.** The conversation specialist exposes the tool table below as Nook jobs; service credentials and specialist credentials remain separate.

**Acceptance.**
1. The registry maps the exact Core clause IDs to these job names and discloses each not-a-tool reason.
2. A message post, note revision, forward and reminder use the same Nook action as their corresponding screen.
3. A notification-app token never becomes sponsor-bound agent authority.

#### SURFACE-002 — Exposure and sensitive-data classification

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Nook computes exposure from the current conversation roster, external-participant status and connector destination, and sensitivity from regulated-data labels and returned fields.

**Acceptance.**
1. A reversible internal message or note action carries standard, with its item count.
2. A share, forward, connector send or retrieval that newly exposes content outside the company adds external, with recipient count and internal, known, new or public counterparty.
3. A regulated personal record or an attachment labeled as containing regulated personal data adds sensitive with record count and data kind; a passage claiming another label changes neither fact.

#### SURFACE-003 — Authority and irreversible decisions

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Nook classifies bindings, grants, protective settings and irreversible removal from the action and current records.

**Acceptance.**
1. Accepting a promise, revising a decision or recording a business sign-off carries commitment with its value and counterparty, under the company’s policy.
2. Changing membership, app access or a device grant carries access with people and widening/narrowing direction.
3. Changing second-factor, credential, scanning or data-protection settings adds security with the named setting.
4. Purging retained content or applying irreversible erasure adds destructive with the affected item count.

#### SURFACE-004 — Provider, spend and live-service classification

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-011

**Requirement.** Nook computes provider and service classes from the action, account state and provider answer.

**Acceptance.**
1. A change to what the business pays carries money with amount, currency and counterparty.
2. Creating an outside account or paid resource adds accounts with its provider.
3. A provider-hosted consent, verification or checkout step that the provider keeps for a person adds gated with provider and step; no agent supplies the person’s password, second factor or CAPTCHA.
4. Publishing a workflow or changing running delivery behavior adds live with its service.

#### SURFACE-005 — Nook records, events and prompts

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-010, BASE-AGENT-013

**Requirement.** Conversation, message, outcome, file, note, schedule and audit resources connect the specialist to current Nook state without copying private bodies into event metadata.

**Acceptance.**
1. The listed Nook resource templates resolve their record types and mutation results link the changed record.
2. Nook message, decision, commitment, membership, delivery and schedule events identify their current resource and support a source-linked handoff.
3. Prompts cover a recap, commitment follow-through and a seeded-week conversation-clerk job with their Core clause IDs.

#### SURFACE-006 — Specialist week under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-013 · *Register:* R-11

**Requirement.** A stranger agent given the Nook URL completes one seeded team week through MCP, using only its sponsor’s conversation and connector scope.

**Acceptance.**
1. Under the all-autonomous company policy, recap a channel, file a decision, propose and accept a sponsor-owned commitment, schedule a reminder and forward authorized evidence outside; every class follows that policy without a policy wait.
2. Under the held company policy, run the same week: standard calls enter review and the other used classes wait for the named test person’s approvals; exact saved revisions run once after approval.
3. Under a company policy blocking the external class, the outside handoff is refused and internal work retains its distinct result.
4. Revoke a source midway and observe no leaked context or unauthorized continuation; reconcile the week’s records, approvals, refusals, reminders and event handoffs.


## Push further


### Push further: accountable agents in the conversation

#### NOOK-054 — Scoped company-context agents and MCP

*Tier:* Core · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-007 · *Rules:* D-1

**Requirement.** The conversation specialist connects granted channels, document sources and delegated people to Nook's tools. Retrieval intersects source, requester and destination audiences; private evidence stays within that intersection even across agent memory. Its posts obey channel posting and broadcast policy. Connecting another MCP server carries access and security; exposing content outside adds external and a binding decision adds commitment, with every disposition decided by the company's policy. The Agent surface defines the jobs; [Agent compatibility](docs/contract/mechanism.md#nook-054) records the former tool names and client checks.

**Acceptance.**
1. Provision a channel agent and read-only MCP client, connect a permission-scoped document and request a summary/post.
2. Deny access to a second private channel, an unlisted tool and a malicious source instruction; revoke membership/grants mid-run and verify no cached context or further tool write escapes.
3. Run the official MCP Inspector against Nook's MCP server and pass its tool-listing and tool-call checks; connect two independent standard MCP clients, one authorized as a member and one as an agent, and see each return only its own permitted messages; a call to an MCP server outside the sponsor's permitted scope is refused.

#### NOOK-055 — Accountable commitment assistant

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** An agent in its granted conversation reads agreed asks and authorized linked records, identifies a possible assignee, scope, deadline, dependencies and source evidence, then records a cited candidate whose commitment class the company's policy decides. A casual mention never creates accepted responsibility; the exact version is accepted as an act of its assignee; an agent acting for that assignee carries commitment under the company's policy and keeps its own attribution. After acceptance, the agent tracks due time and dependency evidence, asks for missing information and proposes revisions/cancellation or a completion report. Completion reports identify the assignee who acts, or the agent acting for that assignee under the company's commitment policy; provider issue closure is evidence, never impersonated human acceptance or verified delivery. Users can dismiss extraction, pause follow-up or revoke grants; revisions renew acceptance.

**Acceptance.**
1. Discuss a vague request, a declined ask and an agreed ask.
2. The assistant produces a cited candidate; deny impersonation of the assignee; an accountable agent's own acceptance carries commitment under the company's policy.
3. Accept, revise a due date and close linked work: under the held company policy require renewed agreement and the assignee's completion, then pause the agent and verify no further chase or external write.

#### NOOK-056 — Decisions that stay current

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** An authorized agent links human decisions to original discussion and explicitly connected project/document evidence, monitors later changes for concrete contradiction or stale assumptions and brings a cited proposed resolution to the responsible author and affected authorized participants. Distinguish a possible contradiction from a proven policy change; show current versions, dates and missing sources. A revision compares the author's current decision version; an agent acting for that author carries commitment under the company's policy and is attributed as the agent. Narrow private evidence stays in its permitted conversation, with no revealing cross-channel alert. Dismiss, snooze, pause and grant revocation stop further monitoring as selected.

**Acceptance.**
1. Record a decision, change its linked authorized project/document to contradict it and produce a source-cited proposal for the original author.
2. Make one source private and one stale, dismiss a false positive and revise the decision as its author; under the held company policy deny an unapproved commitment revision or another author's revision and any wider audience leak.

#### NOOK-057 — Calm follow-through across linked systems

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-011

**Requirement.** For accepted commitments only, an agent reconciles permitted GitHub/Jira/Asana/Vector issue/PR state, HappyToHelp/Zendesk support events, Salesforce context and Uptime/Lamp deployment/alert evidence against the promised outcome. Batch routine updates, flag a concrete blocked dependency and bring the owner a cited next-step proposal. Never equate issue closure, support status or incident recovery with fulfilled human agreement. Recipient quiet time, urgency preferences, escalation recipients, budgets and pause apply; each outside write carries external on an exact source grant and the company's policy decides its disposition. Stale or unavailable sources are shown as unknown and never repaired with invented success.

**Acceptance.**
1. Accept a commitment linked to a PR and support case, deliver duplicate and out-of-order source events, then close/reopen one dependency and revoke another connector.
2. Receive one calm evidence-linked update, an accurate blocked/unknown status and a proposed resolution; deny unauthorized writes and preserve assignee-only completion.

#### NOOK-058 — Stale handoffs and proposed resolution

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1

**Requirement.** Within authorized conversations and accepted dependencies, detect an unacknowledged handoff, missing acceptance, overdue response or conflicting responsible party using explicit due times and the latest permitted evidence. Bring the right people a concise proposed owner/date/next action with citations and uncertainty, ask the proposed assignee to accept and let participants resolve, dismiss or snooze. Escalation rules have an accountable human owner, named recipients, quiet policy and stop condition; reassignment and an accepted promise carry commitment, widening a recipient audience adds external, and the company's policy decides each call without allowing an agent to widen its own authority.

**Acceptance.**
1. Leave a handoff unaccepted, let an accepted dependency become overdue, then provide late evidence and an alternate suggested assignee.
2. The agent separates those states, proposes a cited resolution to the permitted people, stops after resolution/pause and records the new assignee's acceptance truthfully; an equivalent agent action carries commitment under the company's policy.

#### NOOK-059 — Visible and controllable agent execution

*Tier:* Core · *Cites:* BASE-AGENT-009, BASE-AGENT-011, BASE-AGENT-012

**Requirement.** Every scheduled or interactive agent obligation exposes its human owner, purpose, current source grants, run/version, due time, budget, approval, planned actions and stop condition. Runs survive restart with bounded reconciliation and record output citations, tool attempts, provider-confirmed/failed/uncertain effects and user decisions. Pause/revoke prevents new calls and writes, cancels outstanding approval and names any in-flight effect that cannot be recalled. A failed model/provider/tool surfaces a failed or incomplete run with a human resolution path; uncertain writes are reconciled, failed runs stay visible and source-linked records follow the company's policy for every computed class.

**Acceptance.**
1. Under the held company policy, start a scheduled handoff run, inspect and decline its external-class write, interrupt the provider after a step, restart and revoke the grant.
2. The owner sees a durable failed/uncertain state and exact remaining action; no duplicate write, resumed revoked access or commitment outside the held company's policy appears.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Production-signed iOS/Android store listings and desktop signing receipts | NOOK-021 | not run | | |
| R-2 | Real-device fleet display, locked-call and 24-hour delivery measurements | NOOK-096, NOOK-097, NOOK-078 | not run | | |
| R-3 | Human screen-reader pass across daily, administrative and native journeys | NOOK-052 | not run | | |
| R-4 | Dated VPAT and manual WCAG conformance assessment | NOOK-052 | not run | | |
| R-5 | Real Okta, Microsoft Entra ID and Google Workspace tenant interoperability | NOOK-037, NOOK-128 | not run | | |
| R-6 | Live mail-provider inbox receipt and hosted multi-device operation | NOOK-008, NOOK-014, NOOK-015 | not run | | |
| R-7 | Elapsed monthly availability at the declared team size | NOOK-049, NOOK-107, NOOK-131 | not run | | |
| R-8 | Real Slack, Teams, Google Chat, Campfire, Zulip and Mattermost account/export receipts | NOOK-041, NOOK-042, NOOK-043, NOOK-044, NOOK-045, NOOK-046, NOOK-103, NOOK-076, NOOK-088 | not run | | |
| R-9 | Published Zapier directory, Make app and n8n listing approvals | NOOK-064 | not run | | |
| R-10 | Live media, meeting, connector and model-provider tenant receipts | NOOK-022, NOOK-023, NOOK-027, NOOK-028, NOOK-029, NOOK-030, NOOK-035, NOOK-036, NOOK-087 | not run | | |
| R-11 | Stranger-client receipts for Claude, ChatGPT, Codex and Copilot | SURFACE-006 | not run | | |

## Boundaries

- Nook owns workplace conversation and accepted commitments. Envelope owns payroll; Pegboard and Vector own project work; HappyToHelp owns support cases; Porthole owns observability; Uptime and Lamp own operational signals; Chest owns long-lived file ownership. Nook connects their records without absorbing those products.
- Provider acknowledgment, observed device display, human reading and action are distinct. Local emulation, synthetic fixtures and substituted network edges establish only their stated paths.
- Operator disk custody can bypass app privacy for full offline backup. Previously exported files, downloaded content, external archives, provider backups and physical remnants remain outside logical erasure.
- Native apps, migrations, integrations, golden fixtures and first-week buyer gaps remain Core. No Later move is made without an Also noted basis.

- LiveKit Cloud/Twilio may supply media transport/TURN; Apple (APNs, PushKit), Google (FCM) and browser vendors supply push transport, and the publisher-operated Nook Push Gateway (NOOK-078) holds the store apps' push credentials and relays sealed packets for owned installations, or the owner's own credentials and self-built apps take it out of the path; Zoom/Meet/Teams supply linked meetings. Nook owns their admission, context, failure handling and client journey. It does not operate a PSTN carrier, emergency/911 service or public webinar business; buyers obtain those services through their licensed calling/meeting provider.
- Legal advice, formal certification and a regulated health-data service require the organization’s counsel, qualified archive/eDiscovery partner, suitable deployment and provider agreements; a US HIPAA/BAA or certification claim needs its own evidence. Purview/export partners complement Nook’s controls and do not replace them. A hold is an explicit preservation exception to erasure, not a silently completed deletion.
- Nook owns conversation context and accepted commitments, while provider/sibling systems remain authoritative for documents, tickets, projects, CRM, calendars and incident state. Google Drive, Microsoft 365, Notion, GitHub, Jira, Asana, Salesforce, Zendesk and the linked siblings retain their source permissions and provider terms. Integration disconnection cannot delete a copy or undo a write already accepted by another service; show the remaining custody and reconciliation duty.
- Export authority is bounded by the source export and the organization’s approved audience. No adapter invents missing history or converts unknown memberships into public access. All six named incumbent/up-and-comer migrations remain obligations even where provider access, export rights or schema work is difficult.
- Offline cache and external archives require explicit owner/device custody.
- An offline device cannot receive a revocation before reconnect; downloaded exports, already sent notifications, screenshots and provider backups cannot be retroactively recalled. Current live erasure and protected preserved copies have distinct disclosed duties.
- Malware scanning (NOOK-110) reports signature/heuristic results: a clean label means no known threat was detected, never a guarantee. Platform limits, provider outages, US hosting/subprocessor choices and actual USD usage are disclosed. No guaranteed human response, unlimited scale, WCAG certification, end-to-end encryption or regulatory approval is implied by a local test or marketing phrase. Native apps and reliable push, media, source integrations and admin controls stay in scope until proved.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | Talk it through. Get it done. | NOOK-004, NOOK-010 |
| 2 | Turn a message into a decision or a request. Everyone can see who’s on it. | NOOK-004, NOOK-010 |
| 3 | 100% free, open source alternative to Slack and Microsoft Teams. | NOOK-050 |
| 4 | Channels: Public, private and direct. | NOOK-016, NOOK-003 |
| 5 | Threads: Replies stay with their message. | NOOK-016, NOOK-071 |
| 6 | Files: Attach images, PDFs and text files. | NOOK-012 |
| 7 | Search: Find any message you can read. | NOOK-019 |
| 8 | Requests for you, mentions and replies you follow wait in one list. | NOOK-013 |
| 9 | Need to focus? Go quiet for an hour. | NOOK-013, NOOK-032 |
| 10 | Try it beside Slack. Keep Slack running while your team tries Nook. | NOOK-041 |
| 11 | Install it. A few commands, or the guided installer. | NOOK-050 |
| 12 | Bring your Slack history. Public channels come in, read only. | NOOK-041 |
| 13 | Invite your team. Choose the channels each person sees. | NOOK-018, NOOK-093 |
| 14 | Free, and yours to keep. Nook is 100% free and open source. It’s MIT licensed, so your team can use it, change it and run it however you like. | NOOK-050 |

## Status

Judged from the code and tests at commit `9f42ce1ef9193fc3fa2115b7c16164aa16067070` (26 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 0 | 17 | 0 | 17 |
| Target and push further | 0 | 68 | 60 | 128 |
| All | 0 | 85 | 60 | 145 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `NOOK-001` | Current identity and conversation membership (C1) | published | partial | `src/platform/request.server.ts`; `src/platform/storage/context.ts`; `tests/operator-security.mjs`; `tests/storage-guards.mjs` | Carried-done audit has no cited asserting line for Point 1: participant-removal private-read and private-write refusal through HTTP, SSR, search, replay and generated loaders, and unrelated-admin DM refusal. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-002` | Atomic messages, retries and replay (C2) | published | partial | `src/platform/storage/messages.ts`; `src/platform/storage/commands.ts`; `tests/storage-flows.mjs` | Carried-done audit has no cited asserting line for Point 1: original retry result after lost acknowledgment, changed-payload conflict, per-conversation ordering. Point 2: racing-edit version conflict. Cited assertions establish one committed message for retries, delete tombstone, deleted body absent from replay. |
| `NOOK-003` | Fixed DMs and channel membership (C3) | published | partial | `src/platform/storage/commands.ts`; `src/team/channels.server.ts`; `tests/team-runtime.mjs`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: app-created channel, app-created private channel, app-created DM, history disclosure before adding a member, new member reads earlier history. Point 2: removed member history refusal, removed member search refusal, removed member replay refusal, removed member file refusal, DM participant change refusal, unrelated-admin DM refusal. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-004` | Decisions and commitments (C4) | published | partial | `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: recorded discussion decision, proposed commitment. Point 2: another-participant decision-revision refusal, non-assignee acceptance refusal, exact-version assignee acceptance. Point 3: reopened immutable history, human author displayed, source context displayed, reported status displayed. Cited assertions establish assignee completion report. |
| `NOOK-005` | Read cursors and attention (C5) | published | partial | `src/platform/storage/read.ts`; `src/chat/useReadVisibility.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: two-session thread reads, reconnect preserves monotonic unread. Point 2: beyond-frontier read marker refused, closing Attention does not accept work. Cited assertions establish own sends excluded from unread, closing Attention does not mark unseen messages read. |
| `NOOK-006` | Offline restore (C6) | published | partial | `src/platform/storage/portability.mjs`; `scripts/local/transfer.mjs`; `scripts/storage/recover-identities.mjs`; `tests/recovery.test.mjs`; `tests/pilot-journey.mjs` | Carried-done audit has no cited asserting line for Point 1: stopped empty-installation command restore, explicit identity recovery, equivalent conversations, equivalent memberships, equivalent outcome versions, equivalent Attention, equivalent downloaded file bytes. Point 2: altered checksum refused, invalid graph refused, old delivery not revived. Cited assertions establish populated destination refused, old session not revived. |
| `NOOK-007` | Safe rendering and local binding (C7) | published | partial | `src/platform/operator-auth-runtime.mjs`; `src/platform/request.server.ts`; `src/chat/MessageRow.tsx`; `tests/team-security.test.mjs`; `tests/operator-security.mjs` | Carried-done audit has no cited asserting line for Point 1: conversation/import/model content cannot use ambient authority for code, client-side or credentialed fetches or provider effects outside scoped doors. Point 2: cross-origin mutation refused, unsafe local origin refused, production has no dev admission. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-008` | Evidence limits (C8) | published | partial | `ACCEPTANCE.md`; `tests/push-journey.mjs`; `tests/pilot-journey.mjs` | Local core journeys at 1440 and 390 and a hosted sign-in, invitation/mention-mail, populated-installation upgrade and export/restore workflow have recorded proof. Hosted multi-device, real-device push, capacity and full-category acceptance remain unproven. |
| `NOOK-009` | Backup and export (C9) | published | partial | `src/platform/portability.server.ts`; `src/platform/storage/portability.mjs`; `tests/exit-export.test.mjs`; `tests/team-portability.test.mjs` | Carried-done audit has no cited asserting line for Point 1: stopped local command restore, explicit local identity recovery, equivalent local records, equivalent local private media bytes, equivalent local erasure journal. Point 2: hosted owner download through both documented paths, hosted archive D1 records, hosted archive R2 bytes, hosted archive local identity recovery, equivalent hosted records, equivalent hosted file bytes, rebuilt hosted search, equivalent hosted erasure journal. Point 3: non-owner hosted refusal, expired hosted-session refusal, remote restore refusal. Point 4: local archive contains private records, local archive contains media, hosted archive contains private records, hosted archive contains media, live credentials absent from both archives, devices absent from both archives, pending deliveries absent from both archives. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-010` | Commitment revision and cancellation (C10) | published | partial | `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs`; `tests/erasure.test.mjs` | Carried-done audit has no cited asserting line for Point 1: deadline revision renews acceptance, new version binds acceptance. Point 2: explicit cancellation, fresh proposal changes assignee. Point 3: stale acceptance refusal, cross-conversation move refusal, author completion impersonation refused, cancellation terminal in history. Cited assertions establish material text revision renews acceptance, deleted source body absent. |
| `NOOK-011` | Cached retries, synchronization and complete history (C11) | published | partial | `src/platform/storage/history.ts`; `src/platform/storage/commands.ts`; `src/platform/storage/live.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: missed delete restored on reconnect. Point 2: revoked cached retry denied before lookup, no missing durable history. Cited assertions establish complete paged history, missed edit restored on reconnect. The revoked-retry condition also lacks a no-duplicate-history assertion; the cited census precedes that retry condition. |
| `NOOK-012` | Private attachments (C12) | published | partial | `src/platform/storage/files.ts`; `src/team/preview.server.ts`; `src/team/ImagePreview.tsx`; `tests/team-image.test.mjs`; `tests/storage-flows.mjs`; `tests/team-browser.mjs` | Carried-done audit has no cited asserting line for Point 1: private image preview. Point 2: outsider denied, removed member denied, active input refused, oversized input refused, file deletion removes bytes, backup file round trip. Cited assertions establish ordered file binding in app, authorized exact-byte download, corrupt input refused, lost-put retry preserves bytes. |
| `NOOK-013` | Calm attention (C13) | published | partial | `src/family/team-chat/attention.ts`; `src/platform/storage/commands.ts`; `tests/attention.mjs`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: thread follow at both widths, channel mute at both widths, explicit mention routing, urgent-request routing, snooze at both widths, done triage at both widths, quiet time at both widths. Point 2: another session preserves preferences, due items return under current ACL, reads do not accept work. Point 3: authored automatic follow, reply automatic follow, mentioned automatic follow, one-to-one-DM automatic follow, explicit unfollow ends automatic follow. Cited assertions establish restart preserves preferences, triage does not accept work. |
| `NOOK-014` | Email notifications (C14) | published | partial | `src/notify/run.ts`; `src/notify/queue.ts`; `src/notify/compose.ts`; `tests/notify-journey.mjs`; `tests/notify.test.mjs` | Carried-done audit has no cited asserting line for Point 1: read-item cancellation, definite refusal visible, uncertainty visible. Cited assertions establish member opt-in, mention email, commitment-proposal email, burst folding, quiet-time hold, deleted-item cancellation, revoked-item cancellation, retry survives restart, scanner-safe unsubscribe, mail has no private body, mail has no file name. |
| `DOCS-001` | Public documentation from Markdown | published | partial | `src/docs/build/site.ts`; `src/docs/build/render.ts`; `docs/site.json`; `tests/docs-site.test.mjs` | Carried-done audit has no cited asserting line for Point 1: guides open through browser. Point 2: Lobby route preserved, private-workspace route preserved. Cited assertions establish guides build, all declared pages rendered, links resolve, anchors resolve, raw HTML inert, all Markdown sources accounted for. |
| `ERASURE-001` | Member, message and imported-author erasure | published | partial | `src/team/erasure/service.ts`; `src/team/erasure/graph.ts`; `src/team/erasure/auth-identity.ts`; `src/team/erasure/identity.ts`; `tests/erasure.test.mjs`; `tests/erasure-browser.mjs`; `tests/notes-journey.mjs`; `tests/push/erasure.mjs`; `tests/push/archive.mjs` | Carried-done audit has no cited asserting line for Point 1: count preview through Team, count preview through message door, explicit confirmation, pending job continuation. Point 2: unrelated DM denied, insufficient role denied, self erasure denied, last owner denied. Point 3: native content removed, imported content removed, R2 absence verified, only declared structural tombstones retained, audit anonymized, old archive refused with newer journal. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-015` | Web Push (C15) | published | partial | `src/push/run.ts`; `src/push/subscription.ts`; `src/push/crypto.ts`; `tests/push/journey.mjs`; `tests/push/packet.mjs`; `tests/push-service-worker.test.mjs` | Bounded local Web Push and PWA ship, and enabling push turns on mentions, direct messages, followed threads and keyword hits (`src/push/client.ts`, `src/push/devices.ts`, `tests/push/keywords.mjs`); call invites, and browser-vendor/OS receipt and real-device installation evidence are missing. Native transport belongs to NOOK-021 and its push path to NOOK-078. |
| `NOOK-016` | Everyday conversations | target | partial | `src/chat/NewMessage.tsx`; `src/team/channel-lifecycle.server.ts`; `src/team/ChannelSettings.tsx`; `src/team/channels.server.ts`; `src/team/ChannelBrowser.tsx`; `src/team/default-channels.server.ts`; `tests/browser.mjs`; `tests/group-dm.mjs`; `tests/channel-lifecycle.mjs` | Carried-done audit has no cited asserting line for Point 1: two-person app create and join at both widths, root messages exchanged, thread replies exchanged, reactions exchanged, thread permalink survives reload, own edit, own delete. Point 2: outsider private discovery refused, guest discovery limited, guest scope expansion refused. Point 3: public-channel leave removes navigation, private-channel leave removes navigation, leave removes unread, leave removes notification routing, public rejoin, private rejoin without manager refused, mandatory-channel leave refused. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-017` | Composition and typed markup | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Carried-done audit has no cited asserting line for Point 1: formatted text and code, attachment composition, draft resumes on each supported client, interrupted send has one effect. Point 2: 50000-character snippet-or-split choice, 40001-character API refusal, 40000-character API message whole. Point 3: bold conversion, italic conversion, inline-code conversion, fenced-code conversion, list conversion, one undo restores literal characters, plain-text export retains content. Cited assertions establish one previewable snippet message, strike conversion, quote conversion. |
| `NOOK-090` | Personal profile, status and presence | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web profile, time-zone, status and presence workflows remain evidenced. The carried-done audit does not establish a complete journey for status/time-zone changes without changing work acceptance, or thirty-minute expiry on another client across restart. |
| `NOOK-134` | Custom profile fields and people directory | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web field privacy and directory workflows remain evidenced. The carried-done audit cites hidden-field absence; title, phone and manager values, department filtering at both widths and guest scope lack complete carried proof. |
| `NOOK-135` | Private draft state | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web draft resumption and workspace-isolated drafts remain evidenced. Account isolation and resumption on every supported native client across restart lack complete carried proof. |
| `NOOK-136` | Personal sidebar organization | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web sidebar and mark-unread workflows remain evidenced. Complete carried proof for channel/DM section organization and unchanged work acceptance is absent. |
| `NOOK-091` | Built-in conversation commands | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Carried-done audit has no cited asserting line for Point 1: built-in commands precede app commands. Point 2: remind command equals menu action, invite command equals menu action, topic command equals menu action, rename command equals menu action, mute command equals menu action, quiet command equals menu action, status command equals menu action, DM command equals menu action, huddle command equals menu action, GIF command equals menu action, shrug command equals menu action, collapse command equals menu action, leave command equals menu action, each command same permission check, each command same audit, unknown command offers send-as-text. Cited assertions establish forbidden rename private reason, unknown command posts nothing. |
| `NOOK-092` | Drafts and sent messages view | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web Drafts & sent includes an asserted unsent draft from another conversation. Complete carried proof for the scheduled message, its edited time and yesterday’s sent message is absent. |
| `NOOK-137` | Device-held workspace picker | target | partial | `src/chat/Composer.tsx`; `src/chat/composition/useCompositionDelivery.ts`; `src/commands/useCommands.tsx`; `src/profiles/server.ts`; `src/personal/workspace.server.ts`; `src/personal/typing.server.ts`; `src/workspaces/device-list.ts`; `src/workspaces/WorkspacesMenu.tsx`; `tests/composition-browser.mjs`; `src/profiles/FieldSettings.tsx`; `tests/profile-fields-ordering.mjs`; `tests/profiles.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `tests/workspaces-browser.mjs`; `tests/team-portability.test.mjs`; `tests/storage-flows.mjs` | Delivered web workspace picking, isolated drafts, new-installation confirmation and forgetting without sign-out have cited assertions. Complete carried proof for installation-isolated caches and notifications is absent; no native picker is claimed. |
| `NOOK-018` | Invitation and offboarding journeys | target | partial | `src/team/invitations.server.ts`; `src/team/access.ts`; `src/platform/operator-auth-runtime.mjs`; `tests/team-runtime.mjs`; `tests/team-bulk.mjs`; `src/team/bulk-invitations.server.ts`; `src/team/BulkInvitations.tsx`; `tests/team-browser.mjs`; `tests/operator-security.mjs` | One-address confirmed email invitations, member/guest grants, deactivation and explicit regrant ship. Pasted or uploaded bulk invitations (CSV of email, name, role, channels; up to 1,000 rows and 256 KiB) preview invalid addresses, duplicates within the batch, existing accounts, already-pending invitations and unusable rows (an admin or owner role, an unknown channel, a guest with no channel, a missing name) before anything is sent; one action then sends one invitation per remaining address through the same one-use invitation door, five per call so it resumes by repeating it, and pending invitations can be resent or revoked from Team; an accepting person lands in the named channels plus the default channels. Remaining and missing: the preview's flag for addresses refused by domain policy (Nook configures no domain allow list); the optional guest expiry and the 30-day default expiry, because Base's byte-exact invitation lifetime is fixed at seven days; invitation links, whose joiner has no session to issue an invitation from (each use must still confirm a mailbox, create a member in the default channels and write an audit row with the link ID), with the 400-use and 30-day bounds, revocation, the workspace-wide disable and the disable while SSO is enforced (NOOK-037); approved-domain join, invitation requests, admins delegated under NOOK-060, and the one-time code, open-in-app link and QR on invitation email (NOOK-074). |
| `NOOK-093` | Bulk team invitations | target | partial | `src/team/invitations.server.ts`; `src/team/access.ts`; `src/platform/operator-auth-runtime.mjs`; `tests/team-runtime.mjs`; `tests/team-bulk.mjs`; `src/team/bulk-invitations.server.ts`; `src/team/BulkInvitations.tsx`; `tests/team-browser.mjs`; `tests/operator-security.mjs` | One-address confirmed email invitations, member/guest grants, deactivation and explicit regrant ship. Pasted or uploaded bulk invitations (CSV of email, name, role, channels; up to 1,000 rows and 256 KiB) preview invalid addresses, duplicates within the batch, existing accounts, already-pending invitations and unusable rows (an admin or owner role, an unknown channel, a guest with no channel, a missing name) before anything is sent; one action then sends one invitation per remaining address through the same one-use invitation door, five per call so it resumes by repeating it, and pending invitations can be resent or revoked from Team; an accepting person lands in the named channels plus the default channels. Remaining and missing: the preview's flag for addresses refused by domain policy (Nook configures no domain allow list); the optional guest expiry and the 30-day default expiry, because Base's byte-exact invitation lifetime is fixed at seven days; invitation links, whose joiner has no session to issue an invitation from (each use must still confirm a mailbox, create a member in the default channels and write an audit row with the link ID), with the 400-use and 30-day bounds, revocation, the workspace-wide disable and the disable while SSO is enforced (NOOK-037); approved-domain join, invitation requests, admins delegated under NOOK-060, and the one-time code, open-in-app link and QR on invitation email (NOOK-074). |
| `NOOK-094` | Invitation links and requests | target | missing |  | Invitation links, delegated link creation and invitation-request workflow are absent; bulk and one-address email invitations are delivered separately. |
| `NOOK-095` | Verified-domain joining | target | missing |  | Verified-domain joining, DNS validation and second-factor admission for that door are absent. |
| `NOOK-019` | Search conversations and files | target | partial | `src/search/server.ts`; `src/search/parse.ts`; `src/search/terms.ts`; `src/search/files.ts`; `src/chat/SearchView.tsx`; `src/files/server.ts`; `src/files/FilesView.tsx`; `tests/search.mjs`; `tests/search-browser.mjs`; `tests/files.mjs`; `tests/files-browser.mjs`; `tests/saved-search.mjs`; `tests/slack-import/journey.mjs` | Carried-done audit has no cited asserting line for Point 1: PDF phrase found, text-file phrase found, author filter, date filter, channel filter, context opens on each client. Point 2: short Q3 authorized-message matches, short HR authorized-message matches, short Q3 authorized-file matches, short HR authorized-file matches. Point 3: 80000-message complete census, no duplicates, no omissions, revoked snippets absent, revoked counts recomputed, cached results revoked. Point 4: typed and structured filters equal, modifier chips. Point 5: native file in private Files tab, imported file in private Files tab, non-member Files tab absent, non-member workspace files absent. Cited assertions establish imported reply found, deleted-file snippets absent, September in searcher time zone, negative-word exclusion. |
| `NOOK-020` | Saved items and channel pins | target | partial | `src/team/saved.server.ts`; `src/team/saved-policy.ts`; `src/team/saved-reminders.server.ts`; `src/chat/SavedView.tsx`; `src/chat/SavedReminder.tsx`; `src/chat/ReminderCards.tsx`; `src/chat/PinsView.tsx`; `tests/saved-search.mjs`; `tests/saved-reminders.mjs`; `tests/saved-reminders-browser.mjs`; `tests/team-portability.test.mjs` | Carried-done audit has no cited asserting line for Point 1: saved item visible on another device. Cited assertions establish saved DM recovered after restart, channel pin recovered after restart, membership removal tombstones save, source erasure tombstones save, another person cannot list private save, unavailable item has no excerpt. |
| `NOOK-021` | Signed native clients and offline catch-up | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-096` | Native alert defaults and device convergence | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-097` | Native delivery measurement | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-022` | In-context voice, video and screen sharing | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-023` | Zoom, Google Meet and Teams meetings | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-024` | Asynchronous clips, transcripts and call artifacts | target | partial | `tests/notification-apps.mjs`; `tests/integration-tokens-browser.mjs`; `evidence/clips/` | “Retention, export, hold and erasure follow NOOK-038/NOOK-047/OPS inheritance, and deleting a source invokes them.” The positive hold half awaits NOOK-038; no hold state exists and erasure proceeds. Real phone-device capture NOT RUN. |
| `NOOK-025` | App platform and scoped event delivery | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-098` | App direct messages and home | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-099` | App channel management | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-026` | Workflow builder and durable scheduled work | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-027` | Engineering and project integrations | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-028` | Support, sales and operational signals | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-029` | Connected documents and knowledge | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-030` | Calendars, availability and meeting reminders | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-031` | Shared channels between organizations | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-032` | Quiet schedules and personal keyword routing | target | partial | `migrations/0072_quiet_schedule.sql`; `migrations/0074_push_record_sources.sql`; `src/notify/quiet-time.ts`; `src/notify/quiet.ts`; `migrations/0083_personal_keywords.sql`; `src/notify/keywords.server.ts`; `src/notify/KeywordSettings.tsx`; `tests/push/keywords.mjs`; `src/notify/QuietSettings.tsx`; `src/notify/run.ts`; `src/push/policy.ts`; `src/notify/explain.ts`; `tests/notify-journey.mjs`; `tests/notify/quiet.mjs`; `tests/push/quiet.mjs`; `tests/push-journey.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `migrations/0095_vacations.sql`; `migrations/0096_notification_defaults.sql` | Vacation dates reuse quiet-time device/email urgent exceptions and explain Attention holds. First-sign-in offers off-by-default away email, 15-minute/hourly settings and owner-only new-member push/default-channel/email policy, applied once and member-changeable with audit. PARTIAL: call invites remain unbuilt under NOOK-022, so this clause cannot count DONE. Delegated/group defaults remain NOOK-060 gaps. Native clients inherit through the web doors under NOOK-021; they are not a separate Gap. |
| `NOOK-100` | Per-conversation notification levels | target | partial | `migrations/0072_quiet_schedule.sql`; `migrations/0074_push_record_sources.sql`; `src/notify/quiet-time.ts`; `src/notify/quiet.ts`; `migrations/0083_personal_keywords.sql`; `src/notify/keywords.server.ts`; `src/notify/KeywordSettings.tsx`; `tests/push/keywords.mjs`; `src/notify/QuietSettings.tsx`; `src/notify/run.ts`; `src/push/policy.ts`; `src/notify/explain.ts`; `tests/notify-journey.mjs`; `tests/notify/quiet.mjs`; `tests/push/quiet.mjs`; `tests/push-journey.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `migrations/0095_vacations.sql`; `migrations/0096_notification_defaults.sql` | Source scope remains partial. Vacation dates reuse quiet-time device/email urgent exceptions and explain Attention holds. First-sign-in offers off-by-default away email, 15-minute/hourly settings and owner-only new-member push/default-channel/email policy, applied once and member-changeable with audit. PARTIAL: call invites remain unbuilt under NOOK-022, so this clause cannot count DONE. Delegated/group defaults remain NOOK-060 gaps. Native clients inherit through the web doors under NOOK-021; they are not a separate Gap. |
| `NOOK-101` | New-member notification choices | target | partial | `migrations/0072_quiet_schedule.sql`; `migrations/0074_push_record_sources.sql`; `src/notify/quiet-time.ts`; `src/notify/quiet.ts`; `migrations/0083_personal_keywords.sql`; `src/notify/keywords.server.ts`; `src/notify/KeywordSettings.tsx`; `tests/push/keywords.mjs`; `src/notify/QuietSettings.tsx`; `src/notify/run.ts`; `src/push/policy.ts`; `src/notify/explain.ts`; `tests/notify-journey.mjs`; `tests/notify/quiet.mjs`; `tests/push/quiet.mjs`; `tests/push-journey.mjs`; `tests/personal.mjs`; `tests/personal-browser.mjs`; `migrations/0095_vacations.sql`; `migrations/0096_notification_defaults.sql` | Source scope remains partial. Vacation dates reuse quiet-time device/email urgent exceptions and explain Attention holds. First-sign-in offers off-by-default away email, 15-minute/hourly settings and owner-only new-member push/default-channel/email policy, applied once and member-changeable with audit. PARTIAL: call invites remain unbuilt under NOOK-022, so this clause cannot count DONE. Delegated/group defaults remain NOOK-060 gaps. Native clients inherit through the web doors under NOOK-021; they are not a separate Gap. |
| `NOOK-033` | Personal and channel reminders | target | partial | `src/reminders/service.ts`; `src/reminders/runner.ts`; `src/reminders/parse.mjs`; `src/reminders/ReminderEditor.tsx`; `src/reminders/RemindersView.tsx`; `tests/reminders.mjs`; `tests/reminders-browser.mjs`; `tests/exit-export.test.mjs` | Carried-done audit has no cited asserting line for Point 1: personal reminder scheduled, recurring channel reminder scheduled, runs with all clients closed, restart before due. Point 2: one due reminder, snooze, edit, cancel, revoked creator causes no later unauthorized post. Point 3: no weekend occurrence, DST transition, twenty-minute relative reminder, one relative occurrence, ambiguous parse asks again, ambiguous parse saves nothing. Cited assertions establish weekday natural-language recurrence, 0900 creator time zone. |
| `NOOK-034` | Scheduled and recurring messages | target | partial | `src/scheduled/service.ts`; `src/scheduled/runner.ts`; `src/scheduled/files.ts`; `src/scheduled/time.mjs`; `src/scheduled/ScheduleEditor.tsx`; `src/scheduled/ScheduledView.tsx`; `tests/scheduled.mjs`; `tests/scheduled-browser.mjs`; `tests/erasure.test.mjs`; `tests/exit-export.test.mjs` | Carried-done audit has no cited asserting line for Point 1: one-off schedule, weekly recurrence, DST time change, restart at due time, replayed scheduler claim. Point 2: pause prevents posts, cancel prevents posts, removed posting access prevents posts, failure remains visible. Cited assertions establish one post per occurrence. |
| `NOOK-035` | Channel recaps and catch-up digests | target | partial | `tests/notification-apps.mjs`; `tests/search.mjs`; `tests/search-browser.mjs`; `evidence/recaps/` | Carried-done audit has no cited asserting line for Point 1: contradictory source handling, revocation before display refuses recap, private correction, dismissal, source messages unchanged. Point 2: current-authorized range, freshness, uncertainty. Point 3: private feedback attribution, feedback erasure, feedback archive restore. Point 4: organization-label recheck, AI-policy recheck. Cited assertions establish channel recap, thread recap, each factual point matches source link, no private snippet, no invented acceptance, omission count, model does not create work acceptance, feedback readable export. |
| `NOOK-036` | AI search with cited answers | target | partial | `tests/notification-apps.mjs`; `tests/search.mjs`; `tests/search-browser.mjs` | Connected company context waits for NOOK-029; label and AI-policy recheck on retrieval waits for NOOK-040; a live provider receipt (owner-held key, local run) is NOT RUN. |
| `NOOK-037` | SSO, SAML and lifecycle provisioning | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-038` | Retention, legal hold and preservation | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-039` | Compliance search and controlled exports | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-040` | Information protection and data handling | target | partial | `src/platform/storage/context.ts`; `src/platform/storage/files.ts`; `src/push/crypto.ts`; `tests/team-security.test.mjs` | Current-membership private-message/file access and encrypted push exist; labels, DLP, organization AI policy and cross-tool enforcement are missing. |
| `NOOK-041` | Slack export import and guarded undo | target | partial | `src/imports/archive-plan.mjs`; `src/imports/history.ts`; `src/imports/DoorWizard.tsx`; `src/imports/slack.mjs`; `tests/slack-import/journey.mjs`; `tests/pilot-journey.mjs`; `tests/slack-import/cutover.mjs`; `tests/slack-delta-browser.mjs`; `tests/slack-import-browser.mjs`; `tests/slack-private-fixture.mjs` | Supplied private channels and DMs now require exact injective mapped audiences, including a non-member importing owner. Unmapped histories stay unpublished and listed. Integration logs and bot profiles have non-executing dispositions; imported same-pass permalinks resolve only under current membership. Shared histories remain a listed omission. Member-token acquisition/consent/revocation, custom emoji, user groups (NOOK-060), real Pro cutover/live grants (NOOK-088), native pasted/cross-pass permalink resolution and resolved/unresolved cutover counts remain gaps. Personal reminder/star import and complete metadata parity remain gaps; NOOK-077/088 are not advanced. |
| `NOOK-102` | Slack integration cutover checklist | target | partial | `src/imports/archive-plan.mjs`; `src/imports/history.ts`; `src/imports/DoorWizard.tsx`; `src/imports/slack.mjs`; `tests/slack-import/journey.mjs`; `tests/pilot-journey.mjs`; `tests/slack-import/cutover.mjs`; `tests/slack-delta-browser.mjs`; `tests/slack-import-browser.mjs`; `tests/slack-private-fixture.mjs` | Integration logs and bot profiles have non-executing dispositions, and existing incoming-webhook inventory has a mapped notification-app path. The complete integration replacement checklist, all named replacement dispositions and complete real-SDK cutover proof remain absent. |
| `NOOK-103` | Consented Slack member history | target | missing |  | Consented Slack user-token staging, participant consent publication, live custom-emoji and user-group retrieval are absent. |
| `NOOK-104` | Slack cutover invitations | target | partial | `src/imports/archive-plan.mjs`; `src/imports/history.ts`; `src/imports/DoorWizard.tsx`; `src/imports/slack.mjs`; `tests/slack-import/journey.mjs`; `tests/pilot-journey.mjs`; `tests/slack-import/cutover.mjs`; `tests/slack-delta-browser.mjs`; `tests/slack-import-browser.mjs`; `tests/slack-private-fixture.mjs` | Source scope remains partial. Supplied private channels and DMs now require exact injective mapped audiences, including a non-member importing owner. Unmapped histories stay unpublished and listed. Integration logs and bot profiles have non-executing dispositions; imported same-pass permalinks resolve only under current membership. Shared histories remain a listed omission. Member-token acquisition/consent/revocation, custom emoji, user groups (NOOK-060), real Pro cutover/live grants (NOOK-088), native pasted/cross-pass permalink resolution and resolved/unresolved cutover counts remain gaps. Personal reminder/star import and complete metadata parity remain gaps; NOOK-077/088 are not advanced. |
| `NOOK-105` | Slack personal setup import | target | missing |  | Personal Slack reminder/star retrieval and its reset checklist are absent. |
| `NOOK-106` | Slack links after cutover | target | partial | `src/imports/archive-plan.mjs`; `src/imports/history.ts`; `src/imports/DoorWizard.tsx`; `src/imports/slack.mjs`; `tests/slack-import/journey.mjs`; `tests/pilot-journey.mjs`; `tests/slack-import/cutover.mjs`; `tests/slack-delta-browser.mjs`; `tests/slack-import-browser.mjs`; `tests/slack-private-fixture.mjs` | Same-pass imported permalinks resolve only under current membership. Native pasted and cross-pass permalink resolution, complete source-reference parity and resolved/unresolved cutover counts remain gaps. |
| `NOOK-042` | Microsoft Teams migration | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-043` | Google Chat migration | target | partial | `tests/google-chat-import/journey.mjs`; `tests/google-chat-import/browser.mjs`; `src/imports/gchat.mjs`; `docs/google-chat-import.md` | PARTIAL by default: a genuine Workspace export is NOT RUN. The synthetic declared Takeout layout proves mapped spaces/DMs/group DMs, topic threads, supplied edits/deletion tombstones/reactions, file hashes, external-space omission, no-write layout refusal, resume/dedupe and guarded undo after a native reply. Other annotation/metadata layouts are explicitly refused. ZIP and per-file bounds are 32 MiB and 1 MiB. Real-export ownership metadata, fidelity and cutover remain unverified. |
| `NOOK-044` | Campfire ONCE migration | target | partial | `src/imports/campfire.mjs`; `src/imports/campfire-records.mjs`; `src/imports/campfire-capture.mjs`; `src/imports/campfire-effects.mjs`; `src/imports/campfire-reviewed.mjs`; `src/imports/door.ts`; `src/imports/DoorWizard.tsx`; `docs/campfire-import.md`; `tests/campfire-import/fixtures/README.md`; `tests/campfire-import/journey.mjs`; `tests/campfire-import/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: genuine upstream Campfire fixture, open-room history, closed-room history, DM audience, upload bytes preserved, outsider denied. Point 2: incomplete backup refused, unsupported backup refused, resume, guarded undo. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-045` | Zulip migration and topic continuity | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-046` | Mattermost migration | target | partial | `src/imports/mattermost.mjs`; `src/imports/mattermost-records.mjs`; `src/imports/mattermost-capture.mjs`; `src/imports/mattermost-effects.mjs`; `src/imports/mattermost-reviewed.mjs`; `src/imports/DoorWizard.tsx`; `docs/mattermost-import.md`; `tests/mattermost-import/fixtures/README.md`; `tests/mattermost-import/journey.mjs`; `tests/mattermost-import/browser.mjs` | Carried-done audit has no cited asserting line for Point 1: genuine upstream Mattermost fixture, two-team source, private-channel source, DM source, replies, saved items, pinned items, attachment bytes. Point 2: reviewed role mapping, complete declared-item census, outsider denied, resume, undo preserves native messages. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-047` | Readable portability and controlled exit | target | partial | `src/exit/authority.ts`; `src/exit/store.ts`; `src/exit/pages.ts`; `src/exit/files.ts`; `src/exit/catalog.ts`; `src/exit/format.ts`; `src/exit/ReadableExport.tsx`; `src/exit/OwnerExportPolicy.tsx`; `migrations/0062_workspace_readable_export.sql`; `docs/readable-export.md`; `tests/readable-export.test.mjs`; `tests/readable-export-archive.test.mjs`; `tests/readable-export-browser.mjs` | Carried-done audit has no cited asserting line for Point 1: member conversation export, all current member conversations and DMs, never-joined private content absent, left private content absent, revoked export access refused. Point 2: default-off workspace export refused. Point 3: owner identity audited, change time audited, policy version audited, announcement precedes private export. Point 4: workspace DMs, disable policy blocks retrieval, ownership loss blocks retrieval. Point 5: ordinary admin cannot export another DM. Point 6: held copies excluded, hold exclusion named, hold inventory absent. Point 7: unknown old membership direction, unknown old membership time, new join direction and time, new leave direction and time. Point 8: offline HTML readable, cancel, resume large job, all omissions named. Cited assertions establish every active member announcement, populated workspace private content, policy version on export, JSON hash census, file hash census. |
| `NOOK-048` | Team administration and reporting | target | partial | `src/reports/server.ts`; `src/reports/Reports.tsx`; `tests/reports.mjs`; `tests/reports-browser.mjs` | ct ruling applied: team leaders are current full-member channel managers, owners and admins, only over conversations they can currently read. Unreadable private channels, DMs and group DMs form one anonymous bucket, suppressed below five conversations in JSON, the page and CSV; other activity, storage and delivery figures cover readable conversations only. Original channel-creation times, imported message volume, blocked commitment state and separate decision resolution are unavailable and explicitly disclosed. Capacity repeat at 1,000 members / 5,000 channels NOT RUN; retention jobs (NOOK-038), failed workflows (NOOK-026), client-health detail beyond registered push devices (NOOK-021), connector sync beyond import jobs (NOOK-025/027), scheduled report delivery remain unbuilt. |
| `NOOK-049` | Team capacity and complete directories | target | partial | `tests/storage-guards.mjs`; `tests/posting-browser.mjs`; `src/platform/storage/directories.ts`; `src/chat/api.ts`; `src/team/ChannelBrowser.tsx`; `src/team/TeamPanel.tsx`; `tests/composition-browser.mjs`; `tests/recovery.test.mjs` | People/member/admin directory APIs and clients now continue without a 1,000-entry cutoff; team management renders 50 people per page and searches the complete fetched roster; public-channel discovery pages and searches. Existing conversation lists and notification-app lists have no 1,000-entry cap. The legacy administrative array remains compatible and advertises the complete paged collection. Hosted capacity, latency, availability, media/platform failure recovery, restore within RTO and the tested outage/upgrade runbook remain NOT RUN. Unbuilt user-group/app marketplace directories remain gaps; the existing combined DM-name roster still has a 50,000-row bound in the separately owned workspace projection and is not claimed unbounded. |
| `NOOK-107` | Component health and measured recovery | target | partial | `tests/storage-guards.mjs`; `tests/posting-browser.mjs`; `src/platform/storage/directories.ts`; `src/chat/api.ts`; `src/team/ChannelBrowser.tsx`; `src/team/TeamPanel.tsx`; `tests/composition-browser.mjs`; `tests/recovery.test.mjs` | Source scope remains partial. People/member/admin directory APIs and clients now continue without a 1,000-entry cutoff; team management renders 50 people per page and searches the complete fetched roster; public-channel discovery pages and searches. Existing conversation lists and notification-app lists have no 1,000-entry cap. The legacy administrative array remains compatible and advertises the complete paged collection. Hosted capacity, latency, availability, media/platform failure recovery, restore within RTO and the tested outage/upgrade runbook remain NOT RUN. Unbuilt user-group/app marketplace directories remain gaps; the existing combined DM-name roster still has a 50,000-row bound in the separately owned workspace projection and is not claimed unbounded. |
| `NOOK-050` | Owned Nook deployment and data location | target | partial | `src/platform/operator-auth-runtime.mjs`; `src/platform/owner-claim.server.ts`; `src/platform/portability.server.ts`; `scripts/installer/local.mjs`; `tests/installer-workflow.mjs`; `tests/owner-deploy.test.mjs`; `tests/part6.mjs` | Base-backed local lifecycle, owner claim, portability and fake-account deployment checks exist; live hosted/provider/native operating proof, data-location choice, full cost reporting, the published subprocessor list naming the NOOK-078 gateway and the published 50/300-member reference cost with its gateway and owner-credential lines are missing. |
| `NOOK-108` | Measured operating costs | target | partial | `src/platform/operator-auth-runtime.mjs`; `src/platform/owner-claim.server.ts`; `src/platform/portability.server.ts`; `scripts/installer/local.mjs`; `tests/installer-workflow.mjs`; `tests/owner-deploy.test.mjs`; `tests/part6.mjs` | Source scope remains partial. Base-backed local lifecycle, owner claim, portability and fake-account deployment checks exist; live hosted/provider/native operating proof, data-location choice, full cost reporting, the published subprocessor list naming the NOOK-078 gateway and the published 50/300-member reference cost with its gateway and owner-credential lines are missing. |
| `NOOK-051` | Auditable authority and actions | target | partial | `migrations/0071_admin_audit.sql`; `src/audit/`; `src/team/erasure/graph.ts`; `src/exit/catalog.ts`; `tests/audit-runtime.mjs`; `tests/audit-journey.mjs`; `tests/audit-browser.mjs`; `tests/digests.mjs` | Carried-done audit has no cited asserting line for Point 1: membership action in filtered audit, export action in audit, erasure action in audit, admin override in audit, owner CSV export, admin JSON export. Point 2: member denial, guest denial, erased-actor denial, action facts survive archive restore. Point 3: digest-enable event, digest-disable event, body-free digest audit, same-batch digest audit. Cited assertions establish posting-permission action in audit, anonymized attribution. |
| `NOOK-052` | Accessible, responsive daily use | target | partial | `src/chat/QuickNavigation.tsx`; `src/chat/QuickSwitcher.tsx`; `src/chat/quick-threads.ts`; `src/chat/quick-people.ts`; `src/chat/useLastMessageEdit.ts`; `src/platform/storage/latest-edit.ts`; `src/chat/accessibility.css`; `tests/keyboard.mjs`; `tests/keyboard-gaps.mjs`; `tests/quick-switcher.mjs`; `tests/accessibility.mjs`; `src/reminders/RemindersView.tsx`; `tests/reminders-browser.mjs` | Web shortcuts, All unreads/mark-all undo, authoritative last-own-message editing in root/thread/inline composers, visible equivalents and IME/draft/upload/send guards ship. The quick switcher pages complete current-ACL conversation, people, public-channel and followed-thread doors, includes account-isolated ordinary thread visits after unfollow/reload and discards unavailable source labels. Focus, help, fuzzy matching, recency/unread ranking and 1440/390 journeys are covered. Reminder actions retain their write fence until the server’s current card version is loaded, so rapid snooze/cancel stays ordered. Remaining: native shortcuts/text scaling, manual VoiceOver/NVDA and full WCAG 2.2 AA evidence, plus accessibility acceptance for call/agent/native journeys as their underlying clauses ship. |
| `NOOK-053` | Conversation notes and lightweight lists | target | partial | `src/notes/`; `src/exit/catalog.ts`; `src/exit/format.ts`; `src/team/erasure/`; `migrations/0070_conversation_notes.sql`; `tests/notes-journey.mjs`; `tests/notes-browser.mjs`; `tests/erasure.test.mjs` | Carried-done audit has no cited asserting line for Point 1: provider link stays separate. Point 2: removed member denied, note history export, held note custodian preservation, source permissions remain distinct, source authority remains distinct. Cited assertions establish private note created, checklist revised with history, item proposed to another assignee, exact acceptance, note deletion. |
| `NOOK-060` | Organization administration and delegated roles | target | partial | `tests/channel-lifecycle.mjs`; `tests/posting-browser.mjs`; `tests/team-portability.test.mjs`; `src/team/workspace-policy.server.ts`; `src/team/channel-public.server.ts`; `migrations/0087_workspace_channel_policy.sql`; `migrations/0088_channel_descriptions.sql` | Owner-only versioned creation/archive policy, manager-edited description and native private-to-public conversion now extend the existing transfer/default/archive doors. Explicit current-history confirmation names message/file counts, earliest date and full-member audience, writes one notice and audit, and preserves members. Imported channels, converted group-DM destinations and retained-erasure custody remain refused; legal-hold implementation/proof is pending NOOK-039. Public-to-private is unbuilt. TEAM-001 permission to delegate this policy, delegated/custom roles, user groups and mentions, guest expiry, invitation/approved-domain policy and links, message edit/delete windows, moderated custom emoji, group defaults, delegated/group notification defaults, bulk administrative previews and bilateral external shared-channel policy remain gaps. The following clause sentences remain only partially implemented or unbuilt, without narrowing their text: Owners delegate explicit administrative permissions for people, channels, apps, security, billing/usage and compliance, with custom roles and user groups that never confer ordinary access to DMs. Manage channel name, topic, description, owner transfer, public/private policy, archive/restore and workspace navigation with history/audience disclosure before a privacy change; never widen private history silently. Support user-group mentions with visible recipients (channel-wide @channel/@here/@everyone are NOOK-065), guest expiry, invitation policy (who may invite members and guests, invitation links on or off with their maximum expiry and use limit, and invitation requests on or off) and approved email domains, each behaving as NOOK-018 defines, custom emoji with moderated upload, and org-wide defaults that members may override where permitted. Workspace settings enumerate who can create public and private channels, who can invite members and guests (and into which channels), the message edit and delete window (any time, never, or a set number of minutes, with audited admin exception), who can archive channels and who can use broadcast mentions (NOOK-065); default channels are auto-joined by every new member, or every member of a chosen group, at first sign-in. Bulk administrative actions preview affected scopes and retain audit; external shared-channel policy requires both orgs’ approval. It supplies user groups for NOOK-066 (named people and groups may post, reply and broadcast), NOOK-065 (named groups) and NOOK-103's `@group` mapping. Owner-only new-member notification defaults remain covered by NOOK-032; delegated and group defaults wait on TEAM-001 (ct, 23 October 2026). |
| `NOOK-109` | Channel lifecycle and history disclosure | target | partial | `tests/channel-lifecycle.mjs`; `tests/posting-browser.mjs`; `tests/team-portability.test.mjs`; `src/team/workspace-policy.server.ts`; `src/team/channel-public.server.ts`; `migrations/0087_workspace_channel_policy.sql`; `migrations/0088_channel_descriptions.sql` | Source scope remains partial. Owner-only versioned creation/archive policy, manager-edited description and native private-to-public conversion now extend the existing transfer/default/archive doors. Explicit current-history confirmation names message/file counts, earliest date and full-member audience, writes one notice and audit, and preserves members. Imported channels, converted group-DM destinations and retained-erasure custody remain refused; legal-hold implementation/proof is pending NOOK-039. Public-to-private is unbuilt. TEAM-001 permission to delegate this policy, delegated/custom roles, user groups and mentions, guest expiry, invitation/approved-domain policy and links, message edit/delete windows, moderated custom emoji, group defaults, delegated/group notification defaults, bulk administrative previews and bilateral external shared-channel policy remain gaps. The following clause sentences remain only partially implemented or unbuilt, without narrowing their text: Owners delegate explicit administrative permissions for people, channels, apps, security, billing/usage and compliance, with custom roles and user groups that never confer ordinary access to DMs. Manage channel name, topic, description, owner transfer, public/private policy, archive/restore and workspace navigation with history/audience disclosure before a privacy change; never widen private history silently. Support user-group mentions with visible recipients (channel-wide @channel/@here/@everyone are NOOK-065), guest expiry, invitation policy (who may invite members and guests, invitation links on or off with their maximum expiry and use limit, and invitation requests on or off) and approved email domains, each behaving as NOOK-018 defines, custom emoji with moderated upload, and org-wide defaults that members may override where permitted. Workspace settings enumerate who can create public and private channels, who can invite members and guests (and into which channels), the message edit and delete window (any time, never, or a set number of minutes, with audited admin exception), who can archive channels and who can use broadcast mentions (NOOK-065); default channels are auto-joined by every new member, or every member of a chosen group, at first sign-in. Bulk administrative actions preview affected scopes and retain audit; external shared-channel policy requires both orgs’ approval. It supplies user groups for NOOK-066 (named people and groups may post, reply and broadcast), NOOK-065 (named groups) and NOOK-103's `@group` mapping. Owner-only new-member notification defaults remain covered by NOOK-032; delegated and group defaults wait on TEAM-001 (ct, 23 October 2026). |
| `NOOK-061` | Large files, previews and admission policy | target | partial | `tests/files.mjs`; `tests/files-browser.mjs`; `docs/file-previews.md`; `src/files/policy.server.ts`; `src/files/FilePolicySettings.tsx`; `migrations/0092_file_policy.sql`; `tests/file-policy-journey.mjs`; `src/files/resumable.server.ts`; `src/files/resumable-client.ts`; `migrations/0094_resumable_uploads.sql`; `tests/archive-roundtrip.mjs` | Native uploads have ordered 8 MiB resumable private R2 chunks, declared intent/size/hash, verified whole-object completion, one existing attachment binding and owner policy up to 1 GiB; default remains 25 MiB. A near-1 GiB scale point and live R2 provider-failure proof are NOT RUN. Incomplete uploads refuse archive creation by name until reconciled; completed uploads restore without multipart state. Expired parts are retired and a cleared reservation keeps its old intent refused. Uncertain provider operations can require paused reconciliation. Office/HEIC/GIF/video previews, the installation-owned scanner and quarantine remain unbuilt; no file is labelled safe. Metadata-first restricted import admission remains unbuilt; restricted history captures are refused before storing bytes. |
| `NOOK-110` | Malware scanning and quarantine | target | missing |  | Malware scanner, quarantine, scanner-outage policy and signature-update workflow are absent. |
| `NOOK-062` | Private notification preview levels | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-111` | Notification reply and mark-read actions | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-063` | Slack-compatible incoming webhooks | target | partial | `src/notification-apps/webhook.ts`; `src/notification-apps/web-api.ts`; `src/notification-apps/slack-format.ts`; `src/notification-apps/NotificationApps.tsx`; `src/server.ts`; `tests/notification-webhooks.mjs`; `tests/notification-apps.mjs` | Built: the incoming-webhook surface and the first Web API methods. An approved app's channel token in URL form (`/hooks/slack/` followed by the token Nook shows once when the app is approved, stored hashed, revoked by the existing approval revoke) posts through the notification-destination door, so the app identity, posting fence, the one-per-second rate with a burst of twenty and the audit are that door's. It accepts the exact JSON and form `payload=` bodies a repointed `slack-github-action` step and curl send, with `text`, `blocks` (section with fields, header, divider, context), legacy attachments (title, text, fallback and fields only), `thread_ts` (a Nook message ID), and ignores `mrkdwn`, `unfurl_links`, `username`, `icon_emoji` and `icon_url` (the post is shown as the approved app, never as a person, and nothing is fetched); unsupported blocks and fields show the text with a visible notice. It answers `ok` or `no_text`, `invalid_payload`, `channel_not_found` (an unknown thread), `action_prohibited` (the posting fence) and `rate_limited` with `Retry-After`, with no message committed on any refusal. Missing: the other Web API methods (the remaining `chat.*` methods and the `conversations.*`, `views.*` and `reactions.*` methods) with token scopes, the Events API with signed deliveries and retries, slash commands, interactivity and `block_actions`, modals, the full Block Kit subset, app DMs and blocking, channel management, Slack ID mapping, custom username and icon display, and the real GitHub Action and Slack SDK receipts (NOT RUN: only their request shapes are proved against the real Worker). |
| `NOOK-112` | Slack-compatible Web API | target | partial | `src/notification-apps/webhook.ts`; `src/notification-apps/web-api.ts`; `src/notification-apps/slack-format.ts`; `src/notification-apps/NotificationApps.tsx`; `src/server.ts`; `tests/notification-webhooks.mjs`; `tests/notification-apps.mjs` | Source scope remains partial. Built: the incoming-webhook surface and the first Web API methods. An approved app's channel token in URL form (`/hooks/slack/` followed by the token Nook shows once when the app is approved, stored hashed, revoked by the existing approval revoke) posts through the notification-destination door, so the app identity, posting fence, the one-per-second rate with a burst of twenty and the audit are that door's. It accepts the exact JSON and form `payload=` bodies a repointed `slack-github-action` step and curl send, with `text`, `blocks` (section with fields, header, divider, context), legacy attachments (title, text, fallback and fields only), `thread_ts` (a Nook message ID), and ignores `mrkdwn`, `unfurl_links`, `username`, `icon_emoji` and `icon_url` (the post is shown as the approved app, never as a person, and nothing is fetched); unsupported blocks and fields show the text with a visible notice. It answers `ok` or `no_text`, `invalid_payload`, `channel_not_found` (an unknown thread), `action_prohibited` (the posting fence) and `rate_limited` with `Retry-After`, with no message committed on any refusal. Missing: the other Web API methods (the remaining `chat.*` methods and the `conversations.*`, `views.*` and `reactions.*` methods) with token scopes, the Events API with signed deliveries and retries, slash commands, interactivity and `block_actions`, modals, the full Block Kit subset, app DMs and blocking, channel management, Slack ID mapping, custom username and icon display, and the real GitHub Action and Slack SDK receipts (NOT RUN: only their request shapes are proved against the real Worker). |
| `NOOK-113` | Slack event, command and interactive compatibility | target | missing |  | Signed Slack event delivery, command follow-ups and interactive modal/button compatibility are absent. |
| `NOOK-114` | Block formatting and compatibility disclosure | target | partial | `src/notification-apps/webhook.ts`; `src/notification-apps/web-api.ts`; `src/notification-apps/slack-format.ts`; `src/notification-apps/NotificationApps.tsx`; `src/server.ts`; `tests/notification-webhooks.mjs`; `tests/notification-apps.mjs` | Source scope remains partial. Built: the incoming-webhook surface and the first Web API methods. An approved app's channel token in URL form (`/hooks/slack/` followed by the token Nook shows once when the app is approved, stored hashed, revoked by the existing approval revoke) posts through the notification-destination door, so the app identity, posting fence, the one-per-second rate with a burst of twenty and the audit are that door's. It accepts the exact JSON and form `payload=` bodies a repointed `slack-github-action` step and curl send, with `text`, `blocks` (section with fields, header, divider, context), legacy attachments (title, text, fallback and fields only), `thread_ts` (a Nook message ID), and ignores `mrkdwn`, `unfurl_links`, `username`, `icon_emoji` and `icon_url` (the post is shown as the approved app, never as a person, and nothing is fetched); unsupported blocks and fields show the text with a visible notice. It answers `ok` or `no_text`, `invalid_payload`, `channel_not_found` (an unknown thread), `action_prohibited` (the posting fence) and `rate_limited` with `Retry-After`, with no message committed on any refusal. Missing: the other Web API methods (the remaining `chat.*` methods and the `conversations.*`, `views.*` and `reactions.*` methods) with token scopes, the Events API with signed deliveries and retries, slash commands, interactivity and `block_actions`, modals, the full Block Kit subset, app DMs and blocking, channel management, Slack ID mapping, custom username and icon display, and the real GitHub Action and Slack SDK receipts (NOT RUN: only their request shapes are proved against the real Worker). |
| `NOOK-064` | Zapier, Make and n8n connectors | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-065` | Channel-wide mentions: @channel, @here and @everyone | target | partial | `src/broadcast/audience.ts`; `src/broadcast/settings.ts`; `src/broadcast/presence.ts`; `src/platform/storage/message-statements.ts`; `src/broadcast/ConfirmBroadcast.tsx`; `tests/broadcast.mjs`; `tests/broadcast-browser.mjs`; `tests/push/broadcast.mjs`; `tests/notify/broadcast.mjs` | Carried-done audit has no cited asserting line for Point 1: channel push census, quiet recipients deferred, everyone outside default channel refused. Point 2: missing-confirmation conflict, confirmed one send. Point 3: owners-only member refused, unpermitted webhook refused, refusal writes no message. Cited assertions establish 120-member fixture, channel Attention census, channel email census, sender absent, muted recipients absent, ignore-broadcast recipients absent, 119-minus-exclusions count, 30 fresh here recipients, everyone all active non-guests, missing-confirmation writes no message. |
| `NOOK-066` | Channel posting permissions and announcement channels | target | partial | `src/team/posting.server.ts`; `src/team/posting-policy.ts`; `src/team/PostingSettings.tsx`; `src/platform/storage/messages.ts`; `tests/posting.mjs`; `tests/posting-browser.mjs`; `tests/team-portability.test.mjs`; `src/platform/storage/message-statements.ts`; `src/scheduled/runner.ts`; `src/reminders/runner.ts`; `tests/scheduled.mjs`; `tests/reminders.mjs`; `tests/runtime.mjs` | Carried-done audit has no cited asserting line for Point 1: owners-only root policy, replies-off policy. Point 2: member root refused, member reply refused, notification reply refused, Slack webhook refused, Zapier action refused, workflow post refused, earlier schedule visibly fails, read still permitted, reaction still permitted, save still permitted. Point 3: owner post, override audit row. Point 4: open reply succeeds. Cited assertions establish labeled admin override. |
| `NOOK-067` | Forwarding messages and email into conversations | target | partial | `tests/notification-apps.mjs`; `tests/integration-tokens-browser.mjs`; `evidence/forwards/` | Carried-done audit has no cited asserting line for Point 1: public forward note to DM at both widths, original author, original source, note, link-only attribution, link-only body absent, link-only attachment absent, link-only excerpt absent, link-only thread absent, link refuses unauthorized reader, show-message disclosure preview, show-message audit, owner link-only refuses disclosure, source deletion tombstones each copy. Point 2: channel destination, fixed DM destination, group-DM destination, multiple destinations, thread destination, current destination posting permission. Point 3: public body visible, explicit link-only body absent, explicit link-only files absent. Point 4: fresh audience-bound disclosure, body-free disclosure audit, owner link-only before copying, owner block before copying. Point 5: source edit propagates, source delete tombstones descendants, import undo tombstones descendants, author erasure tombstones descendants, cloned bytes erased, hold only preserves custodian copy. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-068` | Safe link previews and app unfurls | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-069` | Organization second-factor enforcement | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-115` | Own sessions and device revocation | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-070` | Conversation polls | target | partial | `src/team/polls.server.ts`; `src/team/poll-custody.ts`; `src/team/PollCard.tsx`; `src/team/PollForm.tsx`; `src/team/polls-export.ts`; `src/team/bookmarks.server.ts`; `src/team/BookmarksBar.tsx`; `src/team/BookmarksManager.tsx`; `src/team/bookmarks-export.ts`; `migrations/0089_polls.sql`; `migrations/0090_bookmarks.sql`; `tests/polls-journey.mjs`; `tests/polls-browser.mjs`; `tests/bookmarks-journey.mjs`; `tests/bookmarks-browser.mjs`; `tests/threads.mjs`; `tests/composition-browser.mjs`; `tests/thread-delivery.mjs`; `migrations/0093_thread_broadcasts.sql` | A native thread reply can also appear in its channel as the same message, with immutable retry identity, posting fences, one edit/delete and one search/export identity. A body-free marker retains its single tombstone. Anonymous polls and bookmarks retain their existing bounded proof. Named polls, reopening restored polls, GIF search (no GIPHY/Tenor key) and translation (NOOK-040/provider) remain gaps. |
| `NOOK-116` | GIF search and posting | target | missing |  | Provider GIF search, rating cap and administrative switch are absent. |
| `NOOK-117` | Thread replies also sent to channel | target | partial | `src/team/polls.server.ts`; `src/team/poll-custody.ts`; `src/team/PollCard.tsx`; `src/team/PollForm.tsx`; `src/team/polls-export.ts`; `src/team/bookmarks.server.ts`; `src/team/BookmarksBar.tsx`; `src/team/BookmarksManager.tsx`; `src/team/bookmarks-export.ts`; `migrations/0089_polls.sql`; `migrations/0090_bookmarks.sql`; `tests/polls-journey.mjs`; `tests/polls-browser.mjs`; `tests/bookmarks-journey.mjs`; `tests/bookmarks-browser.mjs`; `tests/threads.mjs`; `tests/composition-browser.mjs`; `tests/thread-delivery.mjs`; `migrations/0093_thread_broadcasts.sql` | Source scope remains partial. A native thread reply can also appear in its channel as the same message, with immutable retry identity, posting fences, one edit/delete and one search/export identity. A body-free marker retains its single tombstone. Anonymous polls and bookmarks retain their existing bounded proof. Named polls, reopening restored polls, GIF search (no GIPHY/Tenor key) and translation (NOOK-040/provider) remain gaps. |
| `NOOK-118` | Channel bookmarks | target | partial | `src/team/polls.server.ts`; `src/team/poll-custody.ts`; `src/team/PollCard.tsx`; `src/team/PollForm.tsx`; `src/team/polls-export.ts`; `src/team/bookmarks.server.ts`; `src/team/BookmarksBar.tsx`; `src/team/BookmarksManager.tsx`; `src/team/bookmarks-export.ts`; `migrations/0089_polls.sql`; `migrations/0090_bookmarks.sql`; `tests/polls-journey.mjs`; `tests/polls-browser.mjs`; `tests/bookmarks-journey.mjs`; `tests/bookmarks-browser.mjs`; `tests/threads.mjs`; `tests/composition-browser.mjs`; `tests/thread-delivery.mjs`; `migrations/0093_thread_broadcasts.sql` | Source scope remains partial. A native thread reply can also appear in its channel as the same message, with immutable retry identity, posting fences, one edit/delete and one search/export identity. A body-free marker retains its single tombstone. Anonymous polls and bookmarks retain their existing bounded proof. Named polls, reopening restored polls, GIF search (no GIPHY/Tenor key) and translation (NOOK-040/provider) remain gaps. |
| `NOOK-119` | On-request message translation | target | missing |  | Message translation and original-language return are absent. |
| `NOOK-071` | Followed Threads view | target | partial | `src/chat/ThreadsView.tsx`; `src/platform/storage/threads.ts`; `src/chat/AllUnreads.tsx`; `src/platform/storage/unreads.ts`; `src/team/group-conversion.server.ts`; `tests/threads.mjs`; `tests/unreads.mjs`; `tests/group-conversion.mjs`; `tests/unreads-browser.mjs` | Carried-done audit has no cited asserting line for Point 1: three threads across two channels and DM, unread counts at both widths, inline reply, mark-read cross-session, revoked thread removed. Point 2: authored thread listed, replied thread listed, mentioned thread listed, unfollowed thread removed. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-120` | All unreads view | target | partial | `src/chat/ThreadsView.tsx`; `src/platform/storage/threads.ts`; `src/chat/AllUnreads.tsx`; `src/platform/storage/unreads.ts`; `src/team/group-conversion.server.ts`; `tests/threads.mjs`; `tests/unreads.mjs`; `tests/group-conversion.mjs`; `tests/unreads-browser.mjs` | Carried-done audit has no cited asserting line for Point 1: three unread conversations, sidebar order, mark-one-read removes conversation, cross-session read, mark-all clears remaining, ten-second undo restores unread, Attention unchanged. Existing evidence supplies workflows or helper calls, but this audit establishes no complete point from a cited assertion. |
| `NOOK-121` | Group-DM conversion to private channel | target | partial | `src/chat/ThreadsView.tsx`; `src/platform/storage/threads.ts`; `src/chat/AllUnreads.tsx`; `src/platform/storage/unreads.ts`; `src/team/group-conversion.server.ts`; `tests/threads.mjs`; `tests/unreads.mjs`; `tests/group-conversion.mjs`; `tests/unreads-browser.mjs` | Carried-done audit has no cited asserting line for Point 1: three-person conversion, exact channel membership, full original history, complete original roster read-only, old DM read-only, old DM links channel, outsider cannot discover either, conversion audit. Point 2: creator-removal case. Point 3: reactivation grants no private history. Point 4: pre-regrant archive roster, pre-regrant archive membership, pre-regrant archive refusal, post-regrant archive roster, post-regrant archive membership, post-regrant archive access, restart retains boundary. Cited assertions establish former participant kept in roster, former participant excluded from membership, converter manages channel, explicit regrant enables history. |
| `NOOK-072` | Automatic thread follows | target | partial | `src/platform/storage/threads.ts`; `src/platform/storage/thread-badge.ts`; `src/team/conversation-notify.server.ts`; `src/push/devices.ts`; `src/push/queue.ts`; `src/push/snapshot.ts`; `public/sw.js`; `tests/threads.mjs`; `tests/thread-delivery.mjs`; `tests/push-service-worker.test.mjs`; `tests/push/archive.mjs` | Carried-done audit has no cited asserting line for Point 1: phone alert once, desktop app alert once, Threads row unread count. Point 2: later reply alerts author, later reply alerts prior replier. Point 3: later reply alerts mentioned member. Point 4: unfollow suppresses next reply, later mention alerts once, later plain reply stays suppressed, subsequent reply alerts. Point 5: one-to-one DM other participant alerts. Point 6: removed member no alert, removed member no Threads row, import creates no follows, import creates no alerts, first native reply follows. Cited assertions establish authored source on follow, mention creates follow, own reply re-follows. |
| `NOOK-122` | All replies and follow-source visibility | target | partial | `src/platform/storage/threads.ts`; `src/platform/storage/thread-badge.ts`; `src/team/conversation-notify.server.ts`; `src/push/devices.ts`; `src/push/queue.ts`; `src/push/snapshot.ts`; `public/sw.js`; `tests/threads.mjs`; `tests/thread-delivery.mjs`; `tests/push-service-worker.test.mjs`; `tests/push/archive.mjs` | Carried-done audit has no cited asserting line for Point 1: untouched all-thread reply alerts. Point 2: untouched root preference ID, follow object message ID, follow source all, existing stored source unchanged. Point 3: unfollow removes preference entry, unfollow removes Threads entry. Cited assertions establish untouched thread listed, exception list names conversation, Threads source all, mobile-only all thread follows. |
| `NOOK-123` | Mentions-only thread badge choice | target | partial | `src/platform/storage/threads.ts`; `src/platform/storage/thread-badge.ts`; `src/team/conversation-notify.server.ts`; `src/push/devices.ts`; `src/push/queue.ts`; `src/push/snapshot.ts`; `public/sw.js`; `tests/threads.mjs`; `tests/thread-delivery.mjs`; `tests/push-service-worker.test.mjs`; `tests/push/archive.mjs` | The cited fixture asserts a zero computed badge and zero badge values in both encrypted packets, and keeps the reply unread in Threads. It does not assert that the phone and desktop displayed badges remain unchanged after that reply. |
| `NOOK-073` | Active-elsewhere alert routing | target | partial | `src/push/activity.ts`; `src/push/devices.ts`; `src/push/policy.ts`; `src/push/run.ts`; `src/push/DeviceDelivery.tsx`; `src/push/archive.mjs`; `src/exit/catalog.ts`; `migrations/0073_device_delivery_records.sql`; `migrations/0074_push_record_sources.sql`; `migrations/0082_device_mobile_always.sql`; `tests/push-journey.mjs`; `tests/push-clock.mjs`; `tests/push/presence.mjs`; `tests/push/routing.mjs`; `tests/push/delivery-browser.mjs`; `tests/push/retention.mjs`; `tests/push/erasure.mjs`; `tests/push/quiet.mjs`; `tests/push/archive.mjs` | Partial on the web. The view's sentence that older held, released and canceled records stay in export also covers email entries, which are not retained (NOOK-014); changing that copy needs owner UI approval. Native heartbeats, OS lock state, desktop runs and the native per-device choice inherit under NOOK-096; native routing records and the 500-event run inherit under NOOK-097; call invites under NOOK-022; routing-record retention policy under NOOK-038. Web semantics: keyboard, pointer and focus input within ten minutes on a desktop/web client counts as active, with a session-bound 45-second heartbeat expiry covering sleep; visibility alone never counts and the web reports no OS lock state. Account-wide mobile routing defaults to inactive and zero delay, the mobile delay is per account, and "Always send to mobile, even when I'm active" is per account or per registered phone or tablet through `PATCH /api/devices {id,mobileWhenActive:"account" or "always"}`, set only by that member on their own device and removed with the device (devices, and so this choice, do not travel in operational backup, so a restored installation has no devices to hold it); the supported delay is measured from loss of activity, including explicit hidden-page release or heartbeat expiry. Only the member can inspect their devices and routing; owner/admin roles gain no access to another member’s delivery view. The device delivery view reads the live queue for a wall-clock window of the last seven days and at most the latest 100 alerts, and says older records are in export. Every Web Push alert held for activity elsewhere, the mobile delay, a quiet schedule, a quiet snooze or an item snooze, and every release and cancellation, is retained body-free with its alert, hold and cancellation reasons, times and outcome, like the administrative audit (no time expiry; retention policy inherits under NOOK-038). It travels in operational backup/restore, appears only in the member’s own readable export, and is removed when its member is erased or when the message, outcome or member that caused it is erased (NOOK-015). Email entries in the view are explained while queued and follow NOOK-014: problems show for seven days and terminal queue rows are removed after thirty days. Native desktop heartbeats, OS lock state, Windows/Linux/macOS desktop runs and the native per-device choice inherit under NOOK-096; native routing records and the 500-event delivery-bar run inherit under NOOK-097; call invites inherit under NOOK-022. NOOK-072 thread-follow alerts and NOOK-100 phone/tablet rules use device class and follow this routing. |
| `NOOK-124` | Device delivery history and routing custody | target | partial | `src/push/activity.ts`; `src/push/devices.ts`; `src/push/policy.ts`; `src/push/run.ts`; `src/push/DeviceDelivery.tsx`; `src/push/archive.mjs`; `src/exit/catalog.ts`; `migrations/0073_device_delivery_records.sql`; `migrations/0074_push_record_sources.sql`; `migrations/0082_device_mobile_always.sql`; `tests/push-journey.mjs`; `tests/push-clock.mjs`; `tests/push/presence.mjs`; `tests/push/routing.mjs`; `tests/push/delivery-browser.mjs`; `tests/push/retention.mjs`; `tests/push/erasure.mjs`; `tests/push/quiet.mjs`; `tests/push/archive.mjs` | Source scope remains partial. Partial on the web. The view's sentence that older held, released and canceled records stay in export also covers email entries, which are not retained (NOOK-014); changing that copy needs owner UI approval. Native heartbeats, OS lock state, desktop runs and the native per-device choice inherit under NOOK-096; native routing records and the 500-event run inherit under NOOK-097; call invites under NOOK-022; routing-record retention policy under NOOK-038. Web semantics: keyboard, pointer and focus input within ten minutes on a desktop/web client counts as active, with a session-bound 45-second heartbeat expiry covering sleep; visibility alone never counts and the web reports no OS lock state. Account-wide mobile routing defaults to inactive and zero delay, the mobile delay is per account, and "Always send to mobile, even when I'm active" is per account or per registered phone or tablet through `PATCH /api/devices {id,mobileWhenActive:"account" or "always"}`, set only by that member on their own device and removed with the device (devices, and so this choice, do not travel in operational backup, so a restored installation has no devices to hold it); the supported delay is measured from loss of activity, including explicit hidden-page release or heartbeat expiry. Only the member can inspect their devices and routing; owner/admin roles gain no access to another member’s delivery view. The device delivery view reads the live queue for a wall-clock window of the last seven days and at most the latest 100 alerts, and says older records are in export. Every Web Push alert held for activity elsewhere, the mobile delay, a quiet schedule, a quiet snooze or an item snooze, and every release and cancellation, is retained body-free with its alert, hold and cancellation reasons, times and outcome, like the administrative audit (no time expiry; retention policy inherits under NOOK-038). It travels in operational backup/restore, appears only in the member’s own readable export, and is removed when its member is erased or when the message, outcome or member that caused it is erased (NOOK-015). Email entries in the view are explained while queued and follow NOOK-014: problems show for seven days and terminal queue rows are removed after thirty days. Native desktop heartbeats, OS lock state, Windows/Linux/macOS desktop runs and the native per-device choice inherit under NOOK-096; native routing records and the 500-event delivery-bar run inherit under NOOK-097; call invites inherit under NOOK-022. NOOK-072 thread-follow alerts and NOOK-100 phone/tablet rules use device class and follow this routing. |
| `NOOK-074` | Discover and verify a native installation | target | missing |  | Installation descriptors, verified installation discovery and native store handoff are absent. |
| `NOOK-125` | Managed native app deployment | target | missing |  | Signed managed native deployment packages and configuration are absent. |
| `NOOK-126` | Device-bound email codes and app links | target | missing |  | Device-bound email codes and native universal/app-link completion are absent. |
| `NOOK-127` | Desktop-to-mobile QR sign-in | target | missing |  | Desktop-approved single-use QR sign-in and independent phone sessions are absent. |
| `NOOK-128` | Native provider and factor sign-in | target | missing |  | Native personal-provider sign-in, system-browser SSO and factor journeys are absent. |
| `NOOK-075` | External-participant membership | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-129` | External-participant home migration | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-076` | Slack Connect preview and dispositions | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-130` | Slack Connect history and identity cutover | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-077` | Final catch-up import at cutover | target | partial | `tests/notification-apps.mjs`; `tests/slack-import/delta-journey.mjs`; `tests/slack-import/cutover.mjs`; `tests/slack-import/delta-custody.mjs`; `tests/slack-delta-browser.mjs`; `evidence/slack-delta/` | Export-only delta adds and updates; it never tombstones. A Slack export ZIP carries no coverage manifest, so every range remains `unverified` and absent messages are retained. Web semantics: an admin-stated date range at import is recorded as “attested, not verified” metadata and changes nothing about coverage or deletion authority. This shared first-import/delta plan door is owner-only; real past UTC calendar dates are bounded by the Unix epoch and the import day, from before to. The pass records who stated it and when; preview and report show the label and range; undo, owner-readable export, archive/restore and erasure follow the pass. The only deletion proof is a live-grant conversations read over the exact range paged to its end without error; that read may tombstone with provenance `deleted-in-slack` under NOOK-002 and stays in NOOK-088. Cutover-invitation preparation from the same ZIP is built under NOOK-041 and saved with this pass (owner-only choices; undo, owner-readable export, archive/restore and erasure follow the pass); sending stays NOOK-088's scheduled action and NOOK-018's invitation door, and addresses from a live grant stay with NOOK-088. Web semantics: owner-only ZIP delta, default seven-day overlap adjustable up to full history; changed records and later replies are examined even outside overlap, unchanged old rereads skipped. A fresh current-membership baseline digest binds every preview at plan creation; baseline file bytes are hash-checked and bounded to 16 MiB. New public sources become reviewed private channels; private sources, DMs, groups and shared/external channels without proven NOOK-041 audiences stay unimported and counted. Source edits retain immutable provenance before-images, readable history and export; native rows never become import targets. Body-free import-history replay events carry apply/undo changes without unread or alerts. With no verified range, imported-through and last verified remain unverified; explicit deletion facts never erase on a guess. NOOK-088 live grants/app/Connect remain missing. |
| `NOOK-078` | Store-app push registration | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-131` | Push gateway confidentiality and disclosure | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-132` | Native push failure and registration recovery | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-133` | Owner-credential native push | target | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-079` | Scoped integration tokens | target | partial | `migrations/0068_integration_tokens.sql`; `src/integrations/post.server.ts`; `src/integrations/tokens.server.ts`; `src/integrations/secret.ts`; `src/integrations/archive.mjs`; `src/integrations/IntegrationTokens.tsx`; `tests/integration-tokens.mjs`; `tests/integration-tokens-browser.mjs`; `tests/team-portability.test.mjs` | Carried-done audit has no cited asserting line for Point 1: owner creates and copies once at both widths. Point 2: other channel refused, other route refused, service token cannot convey agent authority. Point 3: rotated secret refused, revoked secret refused. Point 4: every action/refusal shown, restored activity retained, restored token absent. Cited assertions establish retry has one message, truthful via label, replacement replays same key, sealed hash only. |
| `NOOK-080` | Notification destination door | target | partial | `tests/notification-apps.mjs`; `tests/integration-tokens-browser.mjs` | Then add a guest, share, archive and revoke: facts change and later posts write nothing. The share step is unproven because NOOK-031 federation is unavailable. |
| `NOOK-081` | Inbound email into conversations | target | missing |  | Depends on NOOK-061. No implementing source/test; acceptance journey above is pending. |
| `NOOK-082` | Scheduled forwarding | target | partial | `tests/notification-apps.mjs`; `tests/scheduled-forwards.mjs`; `tests/integration-tokens-browser.mjs`; `evidence/forwards/` | Carried-done audit has no cited asserting line for Point 1: optional note present, edit pending time, cancel pending time. Point 2: approving session rechecked, each destination posting checked, authorized subset commits atomically. Point 3: no silent disclosure downgrade, restore pauses schedule, restored approving authority absent. Point 4: pending source body absent, pending file snapshot absent, source erasure strips request, sender erasure removes request. Cited assertions establish one due forward, optional note absent, access generation rechecked, source rechecked, owner policy rechecked, refused destination no send, each refusal reason visible. |
| `NOOK-083` | External shared-channel forwarding | target | missing |  | Depends on NOOK-031. No implementing source/test; acceptance journey above is pending. |
| `NOOK-084` | Scheduled catch-up digests | target | partial | `tests/notification-apps.mjs`; `tests/digests.mjs`; `tests/search-browser.mjs`; `evidence/recaps/` | Gap: Shared channels (including in shared channels) remain unproven until NOOK-031; no native shared/external/guest conversation kind exists until NOOK-031 (local shared/unknown audience markers are excluded); no real provider call (NOT RUN); no real mail delivery (NOOK-014 mail fake only). Connected context and label/AI-policy rechecks inherit NOOK-029/040 through NOOK-036. |
| `NOOK-085` | Call recordings and consent artifacts | target | missing |  | Depends on NOOK-022. No implementing source/test; acceptance journey above is pending. |
| `NOOK-086` | Suggested AI clip summaries | target | missing |  | Depends on NOOK-036. No implementing source/test; acceptance journey above is pending. |
| `NOOK-087` | Provider-generated transcripts | target | partial | `src/transcripts/settings.server.ts`; `src/transcripts/request.server.ts`; `src/transcripts/route.server.ts`; `src/transcripts/secret.ts`; `src/transcripts/TranscriptSettings.tsx`; `src/clips/ProviderRequest.tsx`; `src/clips/source.server.ts`; `migrations/0091_provider_transcripts.sql`; `tests/notification-apps.mjs`; `tests/integration-tokens-browser.mjs` | Built: the owner's settings door (off by default, owner only, the key sealed under its own domain label, shown only as held or not and removable, the provider named as a subprocessor by host, a per-installation daily call cap in which every attempted call spends one reservation), and the request door `POST /api/clips/<id>/provider-transcript`. The clip's author and owners and admins who can read the clip may ask, and only after the disclosure is confirmed (the request carries it); an outsider gets the same 404 as a missing clip, a member who is neither author nor admin gets 403, and neither sends anything. The clip bytes go to the one configured provider, as data, no tools, through the network-edge fake in every test; the result enters the clip's transcript as a new revision labelled provider-generated (`source`), with its timestamped cues in the existing cue format, appended only if no human revision landed meanwhile (otherwise the answer is `changed` and nothing is added). A failure (provider error, malformed output, a human edit meanwhile, a spent cap, unreadable audio) shows its reason class, creates no revision, retries nothing and queues nothing. A human correction is the next revision in the existing history. Revisions export, delete and erase with the clip; a restore brings the settings back disabled with the key and call counter absent. Missing or NOT RUN: a live provider receipt (NOT RUN: no key was read or used and no provider was called), the provider-timeout class (built, not asserted: it needs a real 60-second wait), the positive hold half (NOOK-038 is missing, so no hold state exists and none is faked) and call recordings and consent records (NOOK-022 and NOOK-085). An owner setting to allow wider clip-access members to request provider transcripts is unbuilt. Consent is pinned to the disclosed provider version and current authority is rechecked before audio egress. |
| `NOOK-088` | Slack grant and app delta reads | target | missing |  | External dependency: a real Slack Pro workspace and app. |
| `NOOK-089` | Notification destination door extension | target | partial | `tests/notification-apps.mjs`; `tests/notification-extension.mjs` | Carried-done audit has no cited asserting line for Point 1: lost-reply receipt lookup. Point 2: other app refused. Point 3: immutable app-name/channel identity, other pair refused, revoked token refused, withdrawn channel authority refused. Point 4: edit attributed to app in audit. Cited assertions establish approved-channel thread post, one accepted receipt, no second post, replacement approval edits earlier post, original body-free receipt, explicit tombstone, no duplicate effect. An explicit non-acceptance response is not asserted: equality to the never-accepted response proves indistinguishability, but not its non-acceptance field. |
| `NOOK-054` | Scoped company-context agents and MCP | push-further | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-055` | Accountable commitment assistant | push-further | partial | `src/platform/storage/outcomes.ts`; `src/family/team-chat/attention.ts`; `tests/storage-flows.mjs`; `tests/browser.mjs` | Human proposals, exact assignee acceptance, revision and completion reports ship; agent extraction, evidence tracking and controls are missing. |
| `NOOK-056` | Decisions that stay current | push-further | partial | `src/platform/storage/outcomes.ts`; `src/platform/storage/outcome-history.ts`; `tests/storage-flows.mjs` | Human versioned decisions and source links ship; contradiction monitoring and proposed agent resolution are missing. |
| `NOOK-057` | Calm follow-through across linked systems | push-further | partial | `src/notify/run.ts`; `src/family/team-chat/attention.ts`; `src/platform/storage/outcomes.ts`; `tests/notify-journey.mjs`; `tests/attention.mjs` | Human obligations and calm routing ship; connected-system reconciliation, batched agent updates and external-action grants are missing. |
| `NOOK-058` | Stale handoffs and proposed resolution | push-further | missing |  | No implementing source/test; acceptance journey above is pending. |
| `NOOK-059` | Visible and controllable agent execution | push-further | missing |  | No implementing source/test; acceptance journey above is pending. |
| `SURFACE-001` | Conversation specialist registry | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
| `SURFACE-002` | Exposure and sensitive-data classification | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
| `SURFACE-003` | Authority and irreversible decisions | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
| `SURFACE-004` | Provider, spend and live-service classification | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
| `SURFACE-005` | Nook records, events and prompts | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
| `SURFACE-006` | Specialist week under two company policies | target | missing |  | No complete Nook MCP registry, risk classifier and two-policy conformance journey proves these outcomes. |
