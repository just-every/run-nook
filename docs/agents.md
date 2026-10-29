# Company agents in Nook

The conversation clerk uses Nook's `/mcp` door with a short-lived Business
credential bound to a current native person. Its permissions are that person's
current conversation membership and product access. A workspace owner or admin
cannot use this door to open someone else's DM. Service integration tokens and
notification-app credentials keep their existing purposes and do not authenticate
an agent.

This first declared subset supports current conversation, message and outcome
reads; a private or public channel initially containing only the sponsor;
internal channel notes and checklists; recording and revising non-monetary business decisions; note revision and restoration as a new
version; and the sponsor's mute/follow preferences. These are the native services
used by the corresponding screens. Note text, checklist text, discussion and
imported material supply evidence, never authorization. A checked checklist item
does not accept a commitment. Native note history names the agent and the person
it prepared the revision for. The person remains the native author for access
checks; the agent remains the preparer.

The company policy governs the computed `standard` and `commitment` classes for this internal
subset. A caller cannot choose its class or supply an approval. Unset or
unanswered policy, Pause, expired credentials, revoked consent and removed
native access refuse the next call. `/agents` provides the native person controls,
policy state, approvals, reviews and door audit. A held action retains its exact
summary and native revision. Replaying an accepted mutation key returns its one
result; changed arguments conflict. A native note version still guards the first
write and held execution.

External-audience conversation note operations return
`external_audience_not_supported`. This subset does not send messages, forward
content, accept assignee commitments, change access or security, erase records, schedule
work or contact providers. Those existing Nook jobs still use their native person,
device, connector or import doors as applicable. Their agent adapters remain a
contract gap; they are not represented as completed tools or as not-a-tool jobs.
In particular, erasure must account for retained door evidence before enabling an
agent erasure tool, and queued delivery needs originating consent and a fresh
execution admission.

The declared capabilities are `tools`, `policy`, `pause`, `audit` and
`idempotency`. Events, public MCP resources, prompts and subscriptions are
undeclared and return `capability_not_declared`. Native conversation, message,
outcome and note resource readers are retained internally, with native membership
checks, for a later resource-family adoption. Base 0.2.91 withholds mutation
resource links when that family is undeclared; the required same-door resource
receipt is therefore still a Base coordination gap. No provider cost or spend
reservation is offered; non-monetary decisions have zero monetary value and the conformance policy uses `spend: {none: true}`.

The installation uses the signed `/auth/owner-claim` lifecycle declared in
`rer-setup.json`. Signed Business settings bind the Business owner ID to the
native setup owner and teammate IDs to native operator IDs. Email never selects a
sponsor binding. Business team admins are policy editors; native promotion alone
does not give that Business role. This door has no local bearer-credential
adapter.

`agent-surface.json` is the executable registry and conformance journey for this
subset. It uses fresh records created through Nook's production HTTP doors, the
actual migrations and native note writes. No network-edge module is declared:
the exposed tools make no outbound provider call. Native owner/team mail uses
Base's built-in isolated mail edge during verification. The wider contract's
conversation-clerk week, external handoffs, resource receipts and optional
families remain partial.
