# Finding people and channels

The people directory and public-channel browser search the complete authorized collection. In Browse public channels, enter a name and choose Search channels, or choose More channels to continue the current result. Joining still gives access to that channel’s full history.

Workspace people, channel members and the administrator’s Team list load their remaining pages automatically. A guest sees only identities visible through their current scope; each page rechecks current access. Channel details warn when membership approaches the existing 1,000-member channel limit. This is a membership limit, not a directory truncation.

API clients can request `page=1` on `/api/users`, `/api/team` and `/api/conversations/{id}/members`, with `after` (the last id), `limit` and optional `q`. Responses contain `items`, `hasMore`, `cursor` and a named `warning` where applicable. Legacy array responses retain their shape and include continuation headers; the administrative array links to the complete collection because its historical creation-time ordering differs from the stable id order used for paging. `/api/channels` accepts the same cursor, limit and name search without `page=1`.

Local synthetic journeys cover 1,150 people and 5,150 channels. Hosted capacity and latency measurements, availability and recovery objectives remain unproven. User groups and an app marketplace are not built. The existing combined DM-name roster has a separate 50,000-row bound and is not claimed unbounded.
