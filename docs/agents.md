# Agent access

Nook's agent door is an adoption candidate for the CORE capabilities: tools,
policy, pause, audit and idempotency. Principal authorization and owner-bound
consent are mandatory for every call, including native notification delivery.

Base pin: f96363bf919ea3e7ed1837daba6894810a50e4a6 (rer-v0.2.86).
CLI: @runeditrun/rer 0.2.86 (released).

The 0.2.86 loader has no capability-subset contract. This intended declaration
is documented here until a released Base subset door can enforce it. Normal
verification retains every check and its failure exit.

| Optional family | Declaration | Current limit |
| --- | --- | --- |
| Events | Undeclared | Native message, outcome and note events exist; complete event-family proof remains required. |
| Subscriptions | Undeclared | Nook does not offer an integrated native subscription lifecycle. |
| Multi-sponsor | Undeclared | Business binds native teammates; a complete optional multi-sponsor journey is not claimed. |
| Mail edges | Undeclared | Native sign-in and invitation use captured-mail verification; inbox receipt and the full mail family are not claimed. |
| Resource refresh | Undeclared | Current resource readers enforce membership; proactive refresh is not offered. |
| Timed lifecycle | Undeclared | Agent scheduling and timed follow-through are not exposed. |
| Dual host | Undeclared | No complete dual-host agent lifecycle is offered. |
| Queued lifecycle | Undeclared | The shared continuation still lacks distinct identities for repeated deliveries under one originating operation. |
| Owner-native administration | Undeclared | Native invitation, account administration and scoped regrant remain person operations. |

Signed Business settings bind the claimed owner's Business ID to the immutable
native setup-owner ID. A token email cannot choose an account. A teammate must
first complete Nook's native scoped invitation. Business then binds that native
ID; roster email changes retain the binding and never move a native account or
its channel grants. Unknown roster entries remain conflicts. Removing a managed
person deactivates their native identity; returning to a roster cannot restore
channel access without Nook's fresh scoped regrant. A locally promoted admin is
not a Business policy editor. Unmapped, inactive and product-inadmissible people
are refused. Service, import and installation credentials keep their own purpose.

The registry supports permitted conversations and messages; posting and editing;
channel membership and management; native decision and commitment proposals;
notes and checklist proposals; reactions, thread follows, read markers,
attention, saved items, pins, private workspace views, anonymous polls, channel
bookmarks, profiles, sidebar organization, notification choices, quiet time,
sent messages, file metadata and conversation replay. No agent accepts or
completes a commitment as a person. Erasure remains outside the agent registry
until retained door results and pending work have a native custody mapping.

Resources cover conversations, messages, outcomes, files, notes, schedules and
conversation-scoped audit. Every read checks current membership. Owner or admin
status does not open an unrelated DM. Missing and restricted records have the
same refusal. Imported and message text is untrusted. File resources return
metadata without storage keys or credentials.

Open `/agents` with a native person session to inspect policy, activity and
pending approvals. Company policy chooses autonomous, review, approval or
blocked; server-computed classes and summaries determine the exact proposal.
Text claiming approval has no authority. Unset, expired, paused or revoked
permission refuses work. MCP versions are `2026-07-28` and `2025-11-25`.

Agent-origin message and commitment notifications persist their originating
person, agent, consent, scopes, operation and decision snapshot atomically with
the native queue row. Email and push recheck that admission immediately before
the network effect. Revocation cancels with `consent_revoked`; a changed policy
requires fresh preparation. Neither restart nor archive restore revives an old
delivery. Uncertain network outcomes are never blindly resent. The originating
agent-for-person label follows outbound notifications.

Scheduling, forwarding, provider transcription, AI retrieval, invitation
provisioning, credential changes, erasure, connectors, calls and device actions
are not exposed as agent tools. The declared tools use no outbound provider
beyond Base's built-in mail adapters and native Web Push. The conformance network declaration uses only
`https://web.push.apple.com` and validates the native VAPID signature and decrypted
notification payload before returning a vendor receipt. Synthetic recipient keys
exist only in the disposable fixture. Device registration
and provider configuration retain their native person doors. Provider spend
caps are not enforced by the shared door; no spend guarantee is made. Adoption
remains pending the released Base subset door and complete verification.

The held-policy verification currently reports a Base harness gap for the
revoke-only `conversations.leave`: approval executes the native leave, then the
harness retries through an account that no longer has conversation access. Nook
refuses that retry without retained content. The same refusal is required by the
current-authority replay contract; the harness must account for terminal
self-revocation rather than weakening the native membership check.
