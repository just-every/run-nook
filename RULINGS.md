# Nook rulings

### RL-1 — Notification app identity

Date: 22 October 2026 21:55Z. Ruled by: ct. Clauses: NOOK-089.

Ruled default APPROVED by ct, 22 October 2026 21:55Z: app identity is the exact owner/admin-approved (app name, channel) pair read from immutable approval rows, never token text or a client claim; after replacement approval the replacement token may edit earlier posts of that same pair under current authority; no other pair and no revoked token can; a post into a channel the pair can no longer reach is refused; each edit is attributed to the app identity in the existing audit; no new identity table. No new durable category

### RL-2 — Scheduled-forward delivery

Date: 22 October 2026 22:10Z. Ruled by: ct. Clauses: NOOK-082.

Ruled default APPROVED by ct, 22 October 2026 22:10Z: recheck the approving session, access generation, source, owner policy and each destination at delivery; a refused destination sends nothing and the member sees which destination was refused and why; the still-authorized subset commits atomically through NOOK-067 inside NOOK-034's occurrence transaction; never silently downgrade Show message; restores pause schedules and discard approving-session authority; no second scheduler. Native desktop, iOS and Android clients inherit the forward action through the same door when NOOK-021 ships; responsive web at 1440 and 390 is the acceptance. External shared forwarding remains NOOK-083/031. Pending forwards use the existing schedule payload and occurrence ledger; no source body or file snapshot is kept before delivery. Restore pauses the schedule and removes its approving session ID. Source erasure cancels and strips its held request; sender erasure removes it.

### RL-3 — Member digest schedule

Date: 22 October 2026 22:15Z. Ruled by: ct. Clauses: NOOK-084.

Ruled default APPROVED with riders by ct, 22 October 2026 22:15Z: off until the member approves their own daily or weekly in-app or email-link digest; an owner cannot opt anyone else in; access and quiet time are recomputed at delivery; one bounded NOOK-035/036 provider path (8 passages / 32 KiB); next-run cancel and opt-out (an already-delivering occurrence may finish); skipped, never queued and with no retry row, when the shared NOOK-036 daily cap is spent; no digest or answer cache and no embeddings; restored schedules disabled; a body-free NOOK-051 audit row for the member's own enable/disable. Shared and external channels are excluded entirely until NOOK-031 exists (NOOK-035's rule wins over the first sentence's shared-channel phrase). Cap and provider failures are visible to the recipient only, as a reason class with no content, as NOOK-014 does for undelivered email. Member erasure removes the member's schedules and any in-flight occurrence; archives carry no digest schedule state that restores enabled. Corrections and dismissals follow NOOK-035: private, attributed and erased with the member. NOOK-051 inherits digest-schedule enable/disable kinds `digest.enable` and `digest.disable` in the same batch. Gap:

### RL-4 — Cross-app message refusals

Date: 26 October 2026. Ruled by: ct. Clauses: NOOK-112, NOOK-114.

CT policy ruling, 26 October 2026: When an app targets another app identity’s message within its granted conversation, chat.delete returns ok:false with cant_delete_message; chat.update returns ok:false with cant_update_message. The refusal changes no message. This corrects the deletion error name only; current grants, app identity, membership, revocation and posting controls remain unchanged.

### RL-5 — Unsupported-format warning

Date: 26 October 2026. Ruled by: ct. Clauses: NOOK-112, NOOK-114.

CT policy ruling, 26 October 2026: On an accepted Web API message whose formatting Nook cannot render, response_metadata.warnings contains unsupported_formatting as a Nook-specific extension, not a Slack-defined warning code. The payload’s text fallback and the existing visible-notice requirement remain mandatory. Compatibility documentation classifies this behavior as degraded and identifies the extension explicitly. It establishes no Slack validation equivalence. Gap: the complete contracted Block Kit subset, exhaustive method, event, field and block matrix, and real SDK behavior remain unproved where existing evidence is absent.

### RL-6 — Native identity metadata

Date: 26 October 2026. Ruled by: ct. Clauses: NOOK-112, NOOK-114.

CT policy ruling, 26 October 2026: Pending Slack ID mapping, auth.test retains team as the Nook branding display name and team_id as the request URL’s host, including a nondefault port. These are explicitly degraded native metadata: team is not proof of a customer-specific workspace name, and team_id is an origin-local locator, not a Slack workspace ID or a durable installation identifier across host changes. The returned user_id and bot_id identify the existing approved app-name and channel pair, not mapped Slack identities or a person. Compatibility documentation discloses these limits; clients requiring Slack identifier semantics remain unsupported. Gap: stable Slack-style identity mapping and imported Slack ID resolution remain required in NOOK-063 with NOOK-041 and are not satisfied by a hostname or native approval ID.

### RL-7 — Web API failure envelope

Date: 26 October 2026. Ruled by: ct. Clauses: NOOK-112, NOOK-114.

CT policy ruling, 26 October 2026: Web API application-level failures return HTTP 200 with ok:false and the applicable error, including unknown_method for unavailable methods. A rate refusal returns HTTP 429 with ok:false, error ratelimited and Retry-After in seconds. HTTP 200 does not imply application success, and unknown_method does not satisfy any required method. This convention does not alter incoming-webhook status behavior, grant authority, authorize effects on refusal or waive any required Web API, event or app journey.

### RL-8 — Provider-generated transcripts policy

Recorded: 28 October 2026, from the source judged on 26 October 2026. The original decision date and individual ruler are not stated. Clauses: NOOK-087. This entry preserves the adopted implementation default without assigning it to a new ruler.

Built: the owner's settings door (off by default, owner only, the key sealed under its own domain label, shown only as held or not and removable, the provider named as a subprocessor by host, a per-installation daily call cap in which every attempted call spends one reservation), and the request door `POST /api/clips/<id>/provider-transcript`. The clip's author and owners and admins who can read the clip may ask, and only after the disclosure is confirmed (the request carries it); an outsider gets the same 404 as a missing clip, a member who is neither author nor admin gets 403, and neither sends anything. The clip bytes go to the one configured provider, as data, no tools, through the network-edge fake in every test; the result enters the clip's transcript as a new revision labelled provider-generated (`source`), with its timestamped cues in the existing cue format, appended only if no human revision landed meanwhile (otherwise the answer is `changed` and nothing is added). A failure (provider error, malformed output, a human edit meanwhile, a spent cap, unreadable audio) shows its reason class, creates no revision, retries nothing and queues nothing. A human correction is the next revision in the existing history. Revisions export, delete and erase with the clip; a restore brings the settings back disabled with the key and call counter absent. Implementation default ADOPTED: one owner-supplied provider through the same sealed-credential pattern as NOOK-036 (the code names a default model id, no assertion does); only the clip's author and owners and admins who can read it may request. Missing or NOT RUN: a live provider receipt (NOT RUN: no key was read or used and no provider was called), the provider-timeout class (built, not asserted: it needs a real 60-second wait), the positive hold half (NOOK-038 is missing, so no hold state exists and none is faked) and call recordings and consent records (NOOK-022 and NOOK-085). An owner setting to allow wider clip-access members to request provider transcripts is unbuilt. Consent is pinned to the disclosed provider version and current authority is rechecked before audio egress.

### RL-9 — Team administration and reporting policy

Date: Recorded by 26 October 2026; original decision date not stated. Ruled by: ct (as recorded in the old contract). Clauses: NOOK-048.

ct ruling applied: team leaders are current full-member channel managers, owners and admins, only over conversations they can currently read. Unreadable private channels, DMs and group DMs form one anonymous bucket, suppressed below five conversations in JSON, the page and CSV; other activity, storage and delivery figures cover readable conversations only. Original channel-creation times, imported message volume, blocked commitment state and separate decision resolution are unavailable and explicitly disclosed. Capacity repeat at 1,000 members / 5,000 channels NOT RUN; retention jobs (NOOK-038), failed workflows (NOOK-026), client-health detail beyond registered push devices (NOOK-021), connector sync beyond import jobs (NOOK-025/027), scheduled report delivery remain unbuilt.
