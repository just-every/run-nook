import type { ImportSource } from './door-client';

export function SourceInstructions({ kind }: { kind: ImportSource }) {
    if (kind === 'slack') return <><p className="import-lead">ZIPs stay in owner custody.</p><details className="import-more"><summary>How your export is handled</summary><p>This importer makes no Slack or source URL requests. Public-channel JSON and supplied file bytes are supported; private channels and direct messages are excluded. Unsupported event types in a selected channel block the import.</p><p>The export is read on your computer. Only the reviewed, normalized history is uploaded when you create a dry run.</p></details></>;
    return <><p>{kind === 'campfire'
        ? 'Supported: official Campfire Express backup format 1, bootstrap schema. Rails backup layouts and other schemas are refused. Stop writes while taking the source backup, including its SQLite snapshot and uploads.'
        : 'Supported: Mattermost Server 12 bulk export format 1 ZIP with import.jsonl and its data files. Export the complete instance with attachments, roles and custom emoji. Missing referenced bytes and unsupported versions are refused before import.'}</p>
        <p>Original files up to 16 MiB retain their bytes and SHA-256. No source password, session or source role grants access to Nook.</p><p>The export is read on your computer. Only the reviewed, normalized history is uploaded when you create a dry run.</p><a href={`/docs/${kind}-import`}>{kind === 'campfire' ? 'Backup' : 'Export'} format and migration guide</a></>;
}
