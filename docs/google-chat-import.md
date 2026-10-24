# Move Google Chat history into Nook

As the workspace owner, open **Import Slack history**, then **Import Google Chat history**. Choose a local Takeout ZIP. Reading and preview stay on your computer; creating a dry run uploads only the reviewed normalized history and selected file bytes. Nook makes no Google requests and imports no account, session, role or provider grant.

## Supported layout

The ZIP must contain one of these roots: `Groups/` and `Users/`, `Google Chat/Groups/` and `Google Chat/Users/`, or `Takeout/Google Chat/Groups/` and `Takeout/Google Chat/Users/`.

Each `Users/<user>/user_info.json` supplies `name` and `email`. Each `Groups/<group>/group_info.json` supplies `name`, `group_type` (`SPACE`, `DM` or `GROUP_DM`) and a complete `members` array of those user objects. Spaces need an explicit `is_external` or `externally_owned` boolean. External spaces and spaces whose ownership is not supplied are omitted and listed for review.

Each group's `messages.json` is an object with a `messages` array. A message supplies a stable `message_id`, `creator`, `created_date` and `text`. Matching `topic_id` values identify a topic's root and replies. Optional `last_updated_date` records an edit. A `deleted_date` produces a tombstone without retaining the deleted text or attachment bytes. Supported reactions have `emoji` and `reactors` fields. Unsupported annotations or metadata layouts are refused, rather than silently discarded.

Supplied attachments use `attachments` entries with `export_name` relative to the group folder, `name` and `content_type`. Every referenced file must be present, at most 1 MiB, and its SHA-256 is bound to the reviewed import. The whole ZIP reader is bounded to 32 MiB. These are import limits; native resumable uploads have a separate policy.

## Review and apply

Choose a stable namespace and map every participant to a distinct active Nook member. Missing or colliding private mappings leave that history unpublished and listed. The importing owner receives no additional membership. Review channel types, participant counts, omissions and file hashes before creating a dry run.

History remains inert: it creates no unread activity, alerts, accepted work or accounts. Original authors, timestamps, topic relationships and admitted files retain their source meaning. Stable message IDs identify retries. A restarted import resumes its durable job rather than inserting another copy.

Undo removes only unchanged imported work. A native reply or audience change stops destructive undo; it does not remove the later work.

## Evidence boundary

The maintained journey uses a synthetic ZIP in this declared layout. A genuine Workspace Takeout export has not been tested. Other Takeout versions, annotation formats and source-specific metadata require separate admission and remain gaps; this guide is not a claim of complete Google Chat migration parity.
