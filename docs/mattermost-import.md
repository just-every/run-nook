# Move a Mattermost workspace into Nook

Nook reads the archive on your device. Source authentication stays there; only
the reviewed normalized history and selected files are uploaded. Choose the
source namespace and mappings, use **Preview exact import**, accept the named
omissions, then choose **Create dry run**. Review the door's counts, rejections
and differences before **Apply reviewed plan**. A dry run expires after 30
minutes. If an audience or source changes, create a fresh dry run. The history
provides status, reconciliation and guarded Undo, including imports made before
the shared door. A native edit or later work refuses destructive undo.

For another snapshot of the same workspace, keep its source namespace and select
**Compare with the previous import in this source namespace**. Unchanged records
stay in place; source records absent from the new snapshot remain in Nook.

Business imports use the same door. The owner can enable them in Import history
and permanently revoke signing keys; switching access on again keeps revocations.
Workspace archives retain import batches and custody; restoring an archive
leaves Business imports disabled.


A workspace owner can open **Import history → Import Mattermost history**, upload a local bulk export ZIP, and review it before anyone can read the imported history. Nook makes no Mattermost or attachment URL requests.

Use a complete Mattermost Server 12 export in bulk format 1, including attachments, roles, schemes and custom emoji. With local mode enabled, run `mmctl export create --local`, wait for the job to succeed, and download the resulting ZIP. Its root contains `import.jsonl`; referenced files are under `data/`. Keep the export private. Source scope is declared by its generator; Nook cannot establish that the administrator supplied every source record or verify its authenticity.

Each channel keeps its source team name, public/private kind and explicit exported membership. Direct and group conversations keep exactly their exported participant sets. The importing owner receives no extra membership. Mattermost exports no channel owner: the preview names the first exported participant as the new Nook conversation manager. Every current participant and saved-item owner must map to a distinct existing, active Nook full member. Other historical authors may remain external. Built-in bots with an owner absent from the export keep that source reference as a named omission and receive no Nook account. Source passwords, sessions and account credentials are never copied into identities.

Review every source role, including system, team and channel administrator roles, as **Historical label only; no Nook privileges**. Source permissions and schemes appear in the omission inventory and remain historical provenance. They never create an owner, administrator, custodian, credential or account.

The preview reconciles teams, channels, authors, messages, replies, reactions, custom emoji, saves, pins, original file sizes and SHA-256 hashes. Unsupported properties, source system-message types, deleted records and extra archive files are named. Explicitly accept the exact omission inventory and preview again before applying. An unsupported version, ambiguous membership or missing referenced file is refused before publication.

Mattermost 12's [bulk exporter](https://github.com/mattermost/mattermost/blob/v12.0.0/server/channels/app/export.go#L1427) omits reactions on root direct/group posts. A null reaction field therefore produces a named omission with an unknown source total; Nook cannot reconstruct missing reactions. Explicitly supplied direct/group reactions and reply reactions are preserved.

Imported messages are immutable history. They preserve source authors, millisecond timestamps, reply relationships, reaction names and custom emoji bytes. They create no unread activity, notifications, commitments or accepted work. Source saves enter only the mapped person's private Saved collection. Shared channel pins appear in Pins; a pin's unknown source actor stays unknown. Direct-conversation source pins remain visible as historical badges. Collection dates record when Nook imported them; the source supplies no save or pin timestamps. Saved identities are removed from other members' message provenance and readable exports.

The reviewed plan binds the archive, mappings, source roles, current identity authority, audiences and file hashes. Applying records durable checkpoints. Reload and use **Resume** after an interruption; repeating an acknowledged operation does not duplicate source history. Nothing is published until the reviewed job completes.

**Undo** removes only the unchanged imported history and its files. Later native activity or audience changes block reversal and preserve both histories. Private saves and pins retain opaque unavailable references when their source is undone, as they do for other deleted Nook sources; subsequent personal reminders are retained. To migrate again, finish reversal, review the source again and approve a fresh plan.

The supported in-memory archive is bounded to 32 MiB compressed, 64 MiB expanded, 16 MiB per file, five attachments per message, 5,000 archive entries, 100,000 source/nested records, 50 conversations and 128 KiB total custom emoji. Oversized archives are refused, never truncated. A long source channel name receives a reported destination alias; its complete original name remains in provenance. Files retain their exact bytes; content types are identified from image signatures or UTF-8 text and otherwise served as generic binary files.
