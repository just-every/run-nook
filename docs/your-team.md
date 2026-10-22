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

Approve the same app name and channel again to replace its token. Owner, admin or channel manager may revoke through `POST /api/notification-apps/<approval>/revoke`; `/remove` also removes the app's channel grant. Team exposes revocation to owners/admins. Revocation, removal and archive stop app posts, edits and deletes immediately. Nook's normal human moderation still works. Federation is not available, and the sharing acceptance step remains unproved.

The app sends a bearer token to `POST /api/notification-destinations/<channel>/messages`, with JSON `{ "body": "Release notes ready for review" }` and an `Idempotency-Key` of 1–64 letters, digits or `._:-`. Identical retries return the message; changed payloads conflict. The channel shares a bucket of 20 posts that refills at one per second across every app; a refused request returns 429 and `Retry-After` in seconds. Retries of accepted keys consume no quota. App posts and edits store @here / @channel as literal text and create no broadcast-derived attention, at any audience size. Apps are not members and receive no member broadcast authority; no urgent flag, confirmation or explicit mention-recipient list is accepted. Existing channel choices govern ordinary attention and push. Human broadcasts depend on the permitting policy, and restrictive policies may refuse earlier. This token scope does not satisfy or waive NOOK-065's full app, webhook and workflow policy obligations.

`GET /api/notification-destinations/<channel>/audience` returns live facts. Null verified email with `emailVerified: "unknown"` is not proof of a mailbox. The app edits only its own message with `PATCH .../messages/<message>` and JSON `{ "body": "Updated notes", "version": 1 }`, or deletes it with `DELETE` and `{ "version": 1 }`. Another channel and a missing channel have the same refusal. The token never opens the web app or another API.

App posts display their own name and **App** badge. Approval, token issue, revocation, refusals and writes enter the administrative audit. Approvals and messages travel in readable export and operational backup, while tokens, hashes and mailbox proofs do not. Restored approvals need reissue. Erasing the approving person removes their attribution without deleting the app's channel messages; normal channel erasure still applies.

## Ask with cited evidence

Owners configure AI search under **Team → AI search settings**. It starts off. Supply a provider key, model ID and provider origin (default Anthropic Messages, Haiku-class), then enable it. The default daily limit is 20 attempted calls per installation, resetting at UTC midnight; failures consume a reservation. Settings show off, ready or capped and the provider hostname. Saving a replacement key rotates it without revealing the old key. Restores start off and need a new key.

In **Search**, run the ordinary terms/filters first, then enter a question in **Ask with cited evidence**. At most 8 complete passages / 32 KiB from the first authorized results page go to one provider call; messages, thread replies, plain-text files and text-bearing PDFs can contribute. Unsupported/unindexed files and later pages are explicitly not searched by AI. Empty retrieval makes no provider call. Unsupported claims abstain: “No supporting passage was found in the searched passages”. Answers show only verified exact quotes with source, author, date, edited/current and stale marks, separate conflicting evidence and **Open original** links checked under your current membership. They never declare completion, agreement or acceptance. Use **Give feedback** to save a correction without editing a source. No answer cache or embeddings are created. Connected company context waits for NOOK-029; label and AI-policy recheck on retrieval waits for NOOK-040; a live provider receipt (owner-held key, local run) is NOT RUN.

API: `GET /api/ai-search` reads availability; `POST /api/ai-search` accepts `{question,q}` using ordinary search syntax; `POST /api/ai-search/feedback` accepts `{message,correction}`. Owner-only `GET/POST /api/ai-search/settings` reads safe metadata or writes `{enabled,model,baseUrl,dailyCap,version,key?}`. Apps and agents cannot use this session-only door. Provider redirects are refused. Only HTTPS provider origins are accepted, except loopback HTTP in local development. Provider output is untrusted JSON; tools, external links, unknown citation IDs and non-exact quotes are discarded. Settings changes and key rotations are audited.

Notification post receipts are stable across later edits: replaying a live key returns the original receipt and never changes the message. After message erasure, Nook refuses the erased intent rather than returning or resurrecting its content; this preserves ERASURE-001.
