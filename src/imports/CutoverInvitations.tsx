import { useState } from 'react';
import type { Cutover } from './slack-cutover.mjs';

const flagLabel = { 'workspace-owner': 'Slack Workspace Owner', 'workspace-admin': 'Slack Workspace Admin' } as const;
type Choices = Record<string, 'member' | 'admin'>;

/** Invitation preparation from the export's member list. Nothing here is sent:
 * the owner's saved roles wait for the one-use invitation door. */
export function CutoverInvitations({ cutover, choices = {}, onSave, busy = false }: { cutover: Cutover; choices?: Choices; onSave?: (choices: Choices) => Promise<void>; busy?: boolean }) {
    const [draft, setDraft] = useState<Choices>(choices);
    const counts = cutover.counts;
    return <section aria-label="Cutover invitations">
        <h3>Cutover invitations</h3>
        <p>Preparation only. Saving these choices sends no invitation, creates no account and changes no access. A Slack owner or admin is proposed as a member; admin is granted only if you choose it here.</p>
        <dl className="import-counts">
            <div><dt>members</dt><dd>{counts.members}</dd></div><div><dt>guests</dt><dd>{counts.guests}</dd></div>
            <div><dt>need an address</dt><dd>{counts.needsAddress}</dd></div><div><dt>no invitation: deactivated</dt><dd>{counts.deactivated}</dd></div><div><dt>no invitation: bots</dt><dd>{counts.bots}</dd></div>
        </dl>
        <details><summary>Invitation rows ({cutover.rows.length})</summary>
            {cutover.notListed > 0 && <p>{cutover.notListed} more members are not listed here.</p>}
            <ul className="import-omissions">{cutover.rows.map(row => <li key={row.sourceId}>
                <strong>{row.name}</strong><code>{row.sourceId}</code>
                <span>{row.needsAddress ? 'needs an address' : row.email}</span>
                <span>{row.proposed === 'guest' ? `guest · limited to ${row.channels.length ? row.channels.join(', ') : 'no mapped channel'}` : 'member'}</span>
                {row.adminFlag && (onSave
                    ? <label>{flagLabel[row.adminFlag]}: invite {row.name} as
                        <select value={draft[row.sourceId] ?? 'member'} disabled={busy} onChange={event => setDraft({ ...draft, [row.sourceId]: event.target.value as 'member' | 'admin' })}>
                            <option value="member">member (default)</option><option value="admin">admin</option>
                        </select></label>
                    : <span>{flagLabel[row.adminFlag]} · invite as {choices[row.sourceId] ?? 'member'}</span>)}
            </li>)}</ul>
        </details>
        {onSave && cutover.rows.some(row => row.adminFlag) && <button type="button" disabled={busy} onClick={() => void onSave(draft)}>Save invitation choices</button>}
    </section>;
}
