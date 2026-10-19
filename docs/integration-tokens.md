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

- **Rotate** shows a new token and ends the old one at once (`integration_token_rotated`). The name, channels and idempotency keys carry over.
- **Revoke** ends the token (`integration_token_revoked`).

Every create, rotate, revoke, post, repeated post and refusal is listed under **Recent token activity**.

## Backups

Archives leave tokens out, like every other sign-in token and secret. After a restore, create new tokens; the activity record and the "via" labels are kept.
