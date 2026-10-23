# Your team

Owners and admins manage team access. Members use their current channels; guests can use only explicitly granted channels.

## Roles and access

- **Owner:** manages the workspace and can invite owners, admins and members.
- **Admin:** manages member access and can invite members.
- **Member:** uses the channels they can access and can create conversations.
- **Guest:** has the member role with guest access mode and can use only selected channels.

An admin does not get extra access to another person's direct messages. New members see the full history of the channels you grant.

## Invitations

On a hosted workspace, owners and admins open **You → Team**. In **Invite someone**, leave **Action** on **Invite a teammate**, enter their name and email, choose their access type and role, then select the initial channels. Nook sends the one-time invitation through the mail provider configured by the owner; the invitee confirms its link.

## Try a teammate locally

Open the `RER_OPEN` link as the owner, finish `/setup` and create a channel.
In **You → Team**, choose **Enter as local teammate**, or open
`/auth/dev/enter?as=member` in the same browser. This creates the independent
local account `member@dev.localhost`. Return through
`/auth/dev/enter?as=owner`, add the member using the channel's **Details** control,
then re-enter through `/auth/dev/enter?as=member` to use that channel.

The `admin` and `guest` personas are also available at the same route. Each fresh
browser must first open `RER_OPEN`. Local personas have fixed development
addresses and do not accept arbitrary email invitations. No local email is sent
or stored, and there is no local mail viewer.

## Deactivate or restore access

Choose **Deactivate** beside a teammate to disable their account and remove active workspace access. Reactivating an account does not restore channel access or an old session. To let the person back in, explicitly grant selected channels; on a hosted workspace they must use a fresh sign-in link. Locally, re-enter through the admitted browser's persona route.

Hover over a person under **People** (the actions are always shown on a phone) to deactivate, reactivate or erase them. The Team screen also lets an owner or admin remove a person's access to an individual channel. Channel access determines who can read its history and send messages.

## Switching workspaces

Each Nook installation is its own workspace with its own address. **Your workspaces** (in the sidebar, or under **You** on a phone) lists the installations this browser has signed in to. The list is kept on this device, not on any server.

- Choose a workspace to open it at its own address. Sign-in, drafts, caches and notifications stay separate for each one, so signing out of one leaves the others signed in.
- **Add a workspace** opens another installation by its address, such as `chat.example.com`.
- When you open a workspace from the menu, the list goes with you in the link's fragment, which is never sent to a server. A workspace that list has never held is added only after you choose **Add**.
- **Remove** forgets another workspace on this device. It does not sign you out there.

## Your quiet schedule

In **You → Your quiet schedule**, choose your time zone and enable quiet hours. Monday–Friday start at 22:00 and finish at 07:00 by default; change a day’s times or switch it off for an exception. An overnight rule starts on its named weekday, so Thursday’s quiet hours still run into Friday morning when Friday is switched off. Times stay at the declared local clock time across daylight saving changes. Your browser’s travel or time-zone setting does not silently move the schedule.

Email and Web Push wait in the existing delivery queue until quiet hours end, including after a restart. Urgent requests bypass quiet hours only under your separate email or push choice. **Snooze alerts for one hour** adds a temporary hold; ending that snooze keeps the recurring schedule. Quiet and item snoozes are limited to seven days. Attention and **Your device delivery** include an **Explain why** line; delivery to a provider is distinct from a notification observed on your device.

## Notification apps

In **Team → Notification apps**, an owner or admin names an app and checks each channel it may use. There is no all-channel approval. Copy each channel's token once, then dismiss it; neither Nook nor an export can show it again. The app sees that channel's privacy, sharing state and current member list, including verified email when known, guest status and app/bot flags. Existing accounts may report unknown email proof until their next native email confirmation. Changing an email clears its old proof.

Approve the same app name and channel again to replace its token. The owner-approved pair of the exact app name and channel is the app identity; tokens and client claims do not define it. A replacement revokes the previous token and carries that identity, including authority to edit its earlier posts. Another name on the same channel, or the same name on another channel, has no such authority. Owner, admin or channel manager may revoke through `POST /api/notification-apps/<approval>/revoke`; `/remove` also removes the app's channel grant. Team exposes revocation to owners/admins. Revocation, removal and archive stop app posts, edits and deletes immediately. Nook's normal human moderation still works. Federation is not available, and the sharing acceptance step remains unproved.

The app sends a bearer token to `POST /api/notification-destinations/<channel>/messages`, with JSON `{ "body": "Release notes ready for review" }` and an `Idempotency-Key` of 1–64 letters, digits or `._:-`. Add `"thread": "<root-message-id>"` to reply in a live root thread of that approved channel. A missing, deleted or other-channel root returns the same refusal. Posting and replies use the channel’s NOOK-066 permission and the ordinary NOOK-072 follow/notification rules. Identical retries return the original response; changed body or thread conflicts. Each response includes a body-free `receipt: {"id":"<message-id>","version":1,"acceptedAt":"<ISO-time>"}` that stays fixed after edits. The channel shares a bucket of 20 posts that refills at one per second across every app; a refused request returns 429 and `Retry-After` in seconds. Retries of accepted keys consume no quota. App posts and edits store @here / @channel as literal text and create no broadcast-derived attention, at any audience size. Apps are not members and receive no member broadcast authority; no urgent flag, confirmation or explicit mention-recipient list is accepted. Existing channel choices govern ordinary attention and push. Human broadcasts depend on the permitting policy, and restrictive policies may refuse earlier. This token scope does not satisfy or waive NOOK-065's full app, webhook and workflow policy obligations.

`GET /api/notification-destinations/<channel>/client-keys/<key>` with the same bearer token returns `{"accepted":true,"receipt":{"id":"<message-id>","version":1,"acceptedAt":"<ISO-time>"}}` for an accepted key, without a post, body or post-rate charge. A never-used key, another app’s key and another channel’s key all return `{"accepted":false}`. After erasure it returns `{"accepted":false,"state":"tombstone"}`, without the receipt or body. Revocation, removal, archive and sharing refuse lookup under the same destination authority as a post. Lookup uses existing message intent records and erased-intent digests; it adds no durable data or secrets. Credential-free restore preserves approval identity and history but requires reissue before any lookup or write.

`GET /api/notification-destinations/<channel>/audience` returns live facts. Null verified email with `emailVerified: "unknown"` is not proof of a mailbox. The app edits only its own message with `PATCH .../messages/<message>` and JSON `{ "body": "Updated notes", "version": 1 }`, or deletes it with `DELETE` and `{ "version": 1 }`. Another channel and a missing channel have the same refusal. The token never opens the web app or another API.

App posts display their own name and **App** badge. Approval, token issue, revocation, refusals and writes enter the administrative audit. Approvals and messages travel in readable export and operational backup, while tokens, hashes and mailbox proofs do not. Restored approvals need reissue. Erasing the approving person removes their attribution without deleting the app's channel messages; normal channel erasure still applies.

## Ask with cited evidence

Owners configure AI search under **Team → AI search settings**. It starts off. Supply a provider key, model ID and provider origin (default Anthropic Messages, Haiku-class), then enable it. The default daily limit is 20 attempted calls per installation, resetting at UTC midnight; failures consume a reservation. Settings show off, ready or capped and the provider hostname. Saving a replacement key rotates it without revealing the old key. Restores start off and need a new key.

In **Search**, run the ordinary terms/filters first, then enter a question in **Ask with cited evidence**. At most 8 complete passages / 32 KiB from the first authorized results page go to one provider call; messages, thread replies, plain-text files and text-bearing PDFs can contribute. Unsupported/unindexed files and later pages are explicitly not searched by AI. Empty retrieval makes no provider call. Unsupported claims abstain: “No supporting passage was found in the searched passages”. Answers show only verified exact quotes with source, author, date, edited/current and stale marks, separate conflicting evidence and **Open original** links checked under your current membership. They never declare completion, agreement or acceptance. Use **Give feedback** to save a correction without editing a source. No answer cache or embeddings are created. Connected company context waits for NOOK-029; label and AI-policy recheck on retrieval waits for NOOK-040; a live provider receipt (owner-held key, local run) is NOT RUN.

API: `GET /api/ai-search` reads availability; `POST /api/ai-search` accepts `{question,q}` using ordinary search syntax; `POST /api/ai-search/feedback` accepts `{message,correction}`. Owner-only `GET/POST /api/ai-search/settings` reads safe metadata or writes `{enabled,model,baseUrl,dailyCap,version,key?}`. Apps and agents cannot use this session-only door. Provider redirects are refused. Only HTTPS provider origins are accepted, except loopback HTTP in local development. Provider output is untrusted JSON; tools, external links, unknown citation IDs and non-exact quotes are discarded. Settings changes and key rotations are audited.

Notification post receipts are stable across later edits: replaying a live key returns the original receipt and never changes the message. After message erasure, Nook refuses the erased intent rather than returning or resurrecting its content; this preserves ERASURE-001.

## Recap one conversation

Open **Recap this conversation** above its messages. Choose the conversation, the open thread, or unread messages since your current read marker, and optionally a time range. **Ask for recap** uses the owner's existing AI search setting, sealed key and installation daily call cap. It is off by default. The same configured provider is a subprocessor receiving the range and quoted passages. No second key, counter, tools or web access are added.

A request scans at most the first 100 current-authorized messages in the chosen range, in time order. Plain-text and text-bearing PDF files on its first 8 message candidates may contribute. At most 8 complete passages totaling 32 KiB of UTF-8 text reach one provider call. Oversized passages, unsupported files and later candidates are omitted and disclosed; a range may be incomplete. Empty ranges make no call. Shared or external channels are excluded entirely, including from omission counts, until NOOK-031 is available. Inaccessible conversations are never named. Imported history must already be published under its normal rules. Imported history is inert and does not enter the native unread period.

Each displayed point is an exact source quote checked by Nook, with an original-message link, author, date, edit and later-reply freshness. Model-selected unresolved questions are labeled. Source reports may disagree; they are not verified outcomes. Recorded decisions, proposals, accepted obligations and completion reports come only from Decisions & requests. **Correct claim** saves your correction separately; **Dismiss recap** hides that receipt for you. Neither action edits a source.

Every display rereads the range and your current membership. Changed sources are dropped; losing the range refuses the recap without returning its text or filenames. The browser discards the old projection during a recheck. There is no recap cache and no embeddings: the signed, one-day display receipt holds source positions and hashes, not quoted text. Corrections and dismissals are private to their author, included in that person's readable export and operational archives, and removed with their source or author. Retention, erasure and revocation inherit the source tables; organization labels and AI policy recheck inherit NOOK-040. Scheduled digests remain NOOK-084.

API: `POST /api/recaps` accepts `{conversation,thread?,from?,through?,unread?}`; `GET /api/recaps` reports availability and bounds. `POST /api/recaps/show` accepts `{receipt}` and recomputes the viewer's intersection without another provider call. `POST /api/recaps/feedback` accepts `{receipt,kind:"correction"|"dismissal",message?,correction?}`. Session-only: apps and agents cannot call this door. The network-edge fake proves Nook's checks, not real model behavior. Live provider proof is NOT RUN.

### Forward a message

Use a message’s More actions → Forward. Select one or more local conversations and an optional note. A thread link can direct a single destination into its thread. Link only reveals attribution and a source link; opening the source still requires current source access. Show message previews everyone gaining access to the copy and requires confirmation before posting its body and private attachment copies. Owners choose Allow, Link only or Block in Forwarding policy. Source edits update copies; source deletion or author erasure tombstones every descendant. There are no custodian holds yet. Shared/external channels are excluded, and organization labels inherit NOOK-040 when it ships.

### Record and share a clip

Choose Record or upload clip in a conversation you can post to. Start audio, video or screen capture explicitly; stop or cancel with the visible recording controls. You can also select a WebM, MP4/M4A, Ogg audio, MP3 or WAV file up to 25 MiB. Attach the clip, then send its message. Upload failures keep a Retry upload action for the same file.

Recipients load private playback and add timestamped transcript cues or upload a plain UTF-8 WebVTT caption file. Cue buttons seek the player. Correct transcript appends a version; Transcript history keeps earlier text. Cues allow 500 entries, 100,000 text characters and times within 24 hours; WebVTT files allow 560,000 bytes. Transcript saves check the version opened and leave a conflicting correction available to revise.

The source message’s current audience governs media, captions and every transcript version. Readable exports and operational archives carry them and source-inherited policy. Source deletion or author erasure removes the clip and its transcript history. There are no holds yet; erasure proceeds. No transcription provider, AI summary or call recording is used. Real phone-device capture has not been run.

### Schedule a forward

In the existing Forward message dialog, choose destinations, disclosure and note, then an optional **Schedule time** and explicit time zone. Review the same Show message audience before scheduling. The forward appears in **Scheduled**, with destinations, local time, status and occurrence history. Edit its time or cancel it before delivery; changing the source, destination or disclosure requires a fresh reviewed forward. A restored archive pauses it and removes the approving session authority: review a future time and save again.

Delivery default approved by ct on 22 October 2026 22:10Z: the runner rechecks the original approving session, current account, access generation and membership, posting permission and thread in each destination, source access and owner policy. It also rechecks the exact source/audience disclosure proof. A changed or stricter proof refuses that destination with a visible reason; Show message never becomes Link only automatically. Remaining authorized destinations commit together through the ordinary forward door and existing schedule occurrence fence. A retried runner cannot post twice. The normal NOOK-034 time-zone, daylight-saving and late-after-outage rules apply. Source deletion cancels the pending forward and removes its held request; no source body or file snapshot is kept by the schedule. Sender erasure removes it. Your own scheduled-forward metadata travels in readable export; operational backups contain no approving session ID.

API: use the ordinary `POST /api/forwards/preview`, then `POST /api/forwards` with its confirmation, intent and a `schedule: {localAt, zone, recurrence:"none", endDate:null}`. Manage it through `/api/scheduled` and `PATCH /api/scheduled/<id>`, like other scheduled messages. NOOK-082 remains PARTIAL: native desktop, iOS and Android clients remain unproven (NOOK-021); responsive web is proven. No real provider call, live Slack call or consent was used.

### Your unread digest

Beside email and quiet-time settings in **You**, opt in to your own daily or weekly **Unread digest**, choose its first local delivery time, time zone and in-app or email-link delivery. It starts off. The owner must enable the existing AI door first; an owner cannot opt someone else in. Email requires your own email-notification choice and goes only to your own sign-in-verified address. The email contains a signed-in link, with no source snippet. Open a received digest in the existing cited recap surface to see verified quotes, original links, separately recorded outcomes and your correction/dismissal controls.

Defaults approved with riders by ct on 22 October 2026 22:15Z: authorization and unread markers are recomputed at delivery, shared/external conversations remain excluded until NOOK-031, and inaccessible conversations contribute neither names nor omission counts. One provider call uses the same NOOK-035/036 passage/byte bound, sealed key, quote checking, tool/prose rejection and installation daily cap. Quiet time defers generation until its next permitted boundary. A spent cap skips the occurrence with a visible reason rather than queueing it past the cap; provider failures or rejected answers visibly fail without invented content. Cancel or opt-out applies to the next run; a run already delivering may finish. Missed daily/weekly dates are advanced to a future date after one current unread delivery, rather than creating an outbound catch-up burst.

Only you can read your digest records. Current source access and source hashes are checked again when opened. Stored receipts contain source IDs, hashes and quote offsets, never generated answer prose; no answer cache or embeddings are created. Member enable/disable writes body-free `digest.enable` / `digest.disable` administrative audit rows in the same batch. Failures expose a content-free reason class only to the recipient; the administrator audit carries no failure state. Readable exports carry only the exporting member's schedule and receipts. Operational restore disables every digest schedule and never resumes an interrupted send; owner AI settings restore off without a key. Corrections and dismissals remain private and attributed to you and are erased with you. Erasing the recipient removes their schedules, deliveries and any in-flight occurrence; erasing a selected message or file removes its derived delivery.

API: `GET /api/digests`, member-only `POST /api/digests/settings {enabled,cadence,localAt,zone,delivery,version}`, and `GET /api/digests/<id>` for your own received digest. Corrections and dismissal use the ordinary recap feedback door. NOOK-084 remains PARTIAL: shared-channel receipt waits for NOOK-031; real provider and real mail delivery have not run. NOOK-036's connected-context, label/policy and live-provider Gaps remain. No real provider call, live Slack call or consent was used.
