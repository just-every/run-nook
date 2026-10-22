import { ImportCounts } from './DoorPlanPanel';

type Coverage = {
    channel: string; status: string; reason: string;
    observedFirstTimestamp: string | null; observedThroughTimestamp: string | null;
    lastVerifiedAt: string | null;
};
type Delta = {
    overlapDays: number; counts: Record<string, number>;
    coverage: { conversations: Coverage[] };
    memberPreview: { sourceId: string; label: string; status: string; newToHistory?: boolean; externalOnly: boolean }[];
    skipped: { key: string; reason: string }[];
    explicitDeletions: { key: string; channel: string; eventTimestamp: string; status: string; reason: string }[];
};
const reasonLabel = (reason: string) => reason.replace(/-/g, ' ');

/** Report supplied source observations without promoting them to verified coverage. */
export function DeltaReport({ delta }: { delta: Delta }) {
    return <section aria-label="Delta pass report">
        <h3>Delta pass report</h3>
        <p>Overlap: {delta.overlapDays} {delta.overlapDays === 1 ? 'day' : 'days'}.</p>
        <ImportCounts counts={delta.counts} />
        <p>Imported through: unverified. An official Slack ZIP does not certify a complete source range. Observed timestamps describe supplied records; missing records are retained.</p>
        <details><summary>Conversation coverage ({delta.coverage.conversations.length})</summary>
            <ul className="import-omissions">{delta.coverage.conversations.map(row => <li key={row.channel}>
                <code>{row.channel}</code><strong>{row.status}</strong><span>{reasonLabel(row.reason)}</span>
                <span>Observed source timestamps: {row.observedFirstTimestamp ?? 'none'} through {row.observedThroughTimestamp ?? 'none'}.</span>
                <span>Last verified source timestamp: {row.lastVerifiedAt ?? 'unverified'}.</span>
            </li>)}</ul>
        </details>
        <details><summary>Source member preview ({delta.memberPreview.length})</summary>
            <p>Source identities and account status are for review. This pass sends no invitations and grants no access.</p>
            <ul className="import-omissions">{delta.memberPreview.map(member => <li key={member.sourceId}>
                <strong>{member.label}</strong><code>{member.sourceId}</code><span>{member.status}{member.newToHistory?' · new to this imported history':''}{member.externalOnly ? ' · bot/app, external historical identity' : ''}</span>
            </li>)}</ul>
        </details>
        <p>DMs and shared conversations without proven audiences are skipped. Their source metadata does not establish consent or grant access.</p>
        <details><summary>Skipped records ({delta.skipped.length})</summary>
            <ul className="import-omissions">{delta.skipped.map((row, index) => <li key={row.key + ':' + index}><code>{row.key}</code><span>{reasonLabel(row.reason)}</span></li>)}</ul>
        </details>
        <details><summary>Explicit deletion facts ({delta.explicitDeletions.length})</summary>
            <p>These are unverified facts retained from the supplied source. They do not create message tombstones or prove a complete deletion history.</p>
            <ul className="import-omissions">{delta.explicitDeletions.map((row, index) => <li key={row.key + ':' + index}>
                <code>{row.key}</code><span>{row.status} · source event {row.eventTimestamp}</span><span>{reasonLabel(row.reason)}</span>
            </li>)}</ul>
        </details>
    </section>;
}
