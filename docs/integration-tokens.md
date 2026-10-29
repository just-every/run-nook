# Integration tokens

An integration token lets another service, such as a report, a monitor or a CI job, post into chosen channels without anyone's sign-in. Only owners manage them, under **You → Team → Integration tokens**.

## Create a token

1. Name the integration, for example `Vane reports`.
2. Tick the channels it may post to (up to 20). They must be channels or private channels you belong to. A token never posts into a direct message.
3. Choose **Create token** and copy the token. It is shown only this once: Nook keeps a sealed hash, never the token itself.

## Post with it

```sh
curl -X POST https://YOUR-NOOK/api/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer $NOOK_TOKEN" \
  -H "Idempotency-Key: weekly-report-2026-10-19" \
  -H "Content-Type: application/json" \
  -d '{"body":"Weekly traffic report: 1,284 visits."}'
```

- The body carries only `body`. The same `Idempotency-Key` always returns the same message, so a retry never posts twice. A different body under a used key is refused with `409`.
- The message appears as you, labeled "via" the token's name, and follows your current channel membership and the channel's posting permissions. If you leave the channel or stop being an owner, the token stops posting.
- The token works on no other route. It is refused for channels it is not bound to (`integration_token_conversation`), every other API route (`integration_token_route`), and requests that identify themselves as automated agents (`agent_refused`).

## Rotate or revoke

- **Rotate** shows a new token and ends the old one at once (`integration_token_rotated`). The name, channels and idempotency keys carry over. Rotating the installation's `SESSION_SECRET` also ends every integration token (their hashes are sealed with it).
- **Revoke** ends the token (`integration_token_revoked`).

Every create, rotate, revoke, post, repeated post and refusal is listed under **Recent token activity**.

## Backups

Archives leave tokens out, like every other sign-in token and secret. After a restore, create new tokens; the activity record and the "via" labels are kept.

## Slack-compatible webhooks

When you approve a notification app for a channel, Nook also shows a **webhook URL** (once, with the token). A tool that posts to a Slack incoming webhook, such as a GitHub Actions step or a `curl` command, posts to that URL instead. Nook accepts Slack's JSON body, or the form-encoded `payload=` body, with `text`, simple `blocks` (a section with fields, a header, a divider or a context line) and `thread_ts` set to the ID of the message to reply under. The post appears as the approved app, never as a person; a custom username or icon is ignored and nothing is fetched from a link. Formatting Nook does not support shows its text with a note saying so. Nook answers `ok`, or Slack's error words: `no_text`, `invalid_payload`, `channel_not_found`, `action_prohibited` when the channel's posting rules refuse the app, and `rate_limited` with a wait time when the channel's limit is spent. Revoking the approval stops the URL at once; a revoked or unknown URL answers `no_service`.

## Slack Web API

The same panel shows the **Slack Web API base URL**, `https://YOUR-NOOK/api/slack/`. A Slack SDK app or script moves to Nook by changing its API base URL to that address and its token to the app's channel token, sent as `Authorization: Bearer`. Nook accepts the form-encoded and JSON bodies Slack's SDKs send and answers with Slack's `ok`, `error` and `response_metadata.warnings`, for the channel the app was approved for only:

- `auth.test` returns `user`, `user_id` and `bot_id` for the approved app name and channel pair, not a person or a Slack identity. `team` is Nook's name, not your workspace's name. `team_id` is the address your Nook answers on, including its port if it has one; it changes if that address changes and is not a Slack workspace ID. This is degraded identity information. A tool that needs Slack's own IDs does not work with Nook yet.
- `chat.postMessage` posts `text`, `blocks` and `attachments` with the webhook's formatting, and `thread_ts` replies under a message. The post appears as the approved app, and `ts` is the new message's ID.
- `chat.update` and `chat.delete` change or delete only that app's own messages. On another app's message, `chat.update` answers `cant_update_message` and `chat.delete` answers `cant_delete_message`; the message is unchanged.
- `chat.getPermalink` returns a link to a message. It opens only for someone who is a member of the channel.

Posts follow the same approval, posting rules, rate limit and audit as the webhook URL. Formatting Nook does not support is degraded: its text still shows, with a note, and Nook puts `unsupported_formatting` in `response_metadata.warnings`. This is Nook's own warning value; Slack defines no such warning. Refusals use Slack's words: `not_authed` or `invalid_auth` for a missing, unknown or revoked token, `channel_not_found` for any channel outside the approval, `message_not_found`, `cant_update_message`, `cant_delete_message`, `restricted_action` when the channel's posting rules refuse the app, `no_text`, `msg_too_long`, `invalid_arguments`, and `ratelimited` with a `Retry-After` wait. Every Web API refusal answers HTTP 200 with `ok` false and the error word, including `unknown_method`, except `ratelimited`, which answers HTTP 429 with `Retry-After` in seconds. The webhook URL keeps its own answers, including `no_service` and `rate_limited`. Other methods answer `unknown_method` and change nothing. The opt-in message reads and signed incoming requests below are a limited Nook interface; outgoing Slack Events API delivery, slash commands, modals and full Slack SDK compatibility remain unavailable.


## Signed app requests and message reads

A signed-in owner or admin can approve these additional capabilities through `POST /api/notification-apps`: send the app `name`, the explicitly approved `channels`, `messageReads: true` to allow message reads, the platform's `signingSecret` to receive signed events, and `interactivity: true` to permit posting as that installing person. Each returned approval has its own channel token and public URLs `/hooks/slack/<approval-id>/events` and `/hooks/slack/<approval-id>/interactivity`. Sign the exact request body using HMAC-SHA256 over `v0:<timestamp>:<body>`, send the hexadecimal result prefixed with `v0=` as `X-Slack-Signature`, and send Unix seconds as `X-Slack-Request-Timestamp`; requests with timestamps more than five minutes from the current time, wrong signatures and previously accepted requests are refused without effect. Events accept a JSON `event_callback` with a unique `event_id` and a `message` or `app_mention` event carrying `channel`, `text` and optional `thread_ts`; the delivered message appears as the app. Interactivity accepts JSON or a form `payload` containing one `block_actions` button with `action_id: post_message` and its text in `value`, or a `shortcut` or `message_action` with `callback_id: post_message`, `channel: {id: ...}` and `text`. These are Nook's limited action shapes, not full Slack compatibility. Each action posts as the installer, ignores any supplied user identity, checks their current membership and posting authority, and commits exactly one body-free audit entry with its effect. With the channel token in `Authorization: Bearer`, `conversations.history` and `conversations.replies` at the Web API base URL return only live messages that the installer can currently read in that approved channel; use `channel`, `limit` (up to 100), `cursor`, and `ts` for a thread. An unapproved read capability returns `missing_scope` with `needed: channels:history` and `provided`; an unreadable or unapproved channel returns `channel_not_found`. Existing notification tokens receive no new permissions. Revoke the approval to stop every new request, or uninstall with `POST /api/notification-apps/<approval-id>/remove`: the token and signing secret are removed immediately. Installer erasure also removes these credentials. Backups exclude these capabilities, signing secrets and replay receipts, so restoring never re-enables them.
