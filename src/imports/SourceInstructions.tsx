import type { ImportSource } from './door-client';

// One line says what to upload; everything else about the file and the import sits under How your export is handled.
const upload: Record<ImportSource, string> = {
    slack: 'Choose the ZIP you exported from Slack.',
    campfire: 'Choose the backup file you made in Campfire.',
    mattermost: 'Choose the bulk export ZIP from Mattermost.',
    gchat: 'Choose the Takeout ZIP from Google Chat.',
};
const source: Record<ImportSource, string> = {
    slack: 'This importer makes no Slack or source URL requests. Public-channel JSON and supplied file bytes are supported. Supplied private channels and DMs require an exact injective member mapping; unmapped history stays unpublished. Unsupported event types in a selected channel block the import.',
    campfire: 'Supported: official Campfire Express backup format 1, bootstrap schema. Rails backup layouts and other schemas are refused. Stop writes while taking the source backup, including its SQLite snapshot and uploads.',
    mattermost: 'Supported: Mattermost Server 12 bulk export format 1 ZIP with import.jsonl and its data files. Export the complete instance with attachments, roles and custom emoji. Missing referenced bytes and unsupported versions are refused before import.',
    gchat: 'Google Chat Takeout ZIP: Groups/…/group_info.json and messages.json, Users/…/user_info.json, and supplied attachments. Externally owned spaces are omitted. Every participant must map to a distinct active member; no account or access is created. History stays inert. Unsupported layouts and annotation formats are refused before upload. Supplied edit dates, deletion tombstones and emoji/reactor lists retain their source meaning. No Google requests are made.',
};
// The format guide stays one tap away beside the line, not in the fold.
const guide: Partial<Record<ImportSource, string>> = { campfire: 'Backup format and migration guide', mattermost: 'Export format and migration guide' };
const files = 'Original files up to 16 MiB retain their bytes and SHA-256. No source password, session or source role grants access to Nook.';
const local = 'The export is read on your computer. Only the reviewed, normalized history is uploaded when you create a dry run.';
const jobs = 'Progress survives closing this page and restarting the application. Undo removes only unchanged records owned by that import; later live work or references stop removal.';

export function SourceInstructions({ kind }: { kind: ImportSource }) {
    return <><p className="import-lead">{upload[kind]}{guide[kind] && <> <a href={`/docs/${kind}-import`}>{guide[kind]}</a></>}</p><details className="import-more"><summary>How your export is handled</summary>
        <p>{source[kind]}</p>{(kind === 'campfire' || kind === 'mattermost') && <p>{files}</p>}<p>{local}</p><p>{jobs}</p>
    </details></>;
}
