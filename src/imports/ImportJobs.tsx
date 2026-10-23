import { DeltaReport } from './DeltaReport';
import { AttestationReport } from './AttestationReport';
import type { ImportHistory } from './door-client';

type Props = {
    jobs: ImportHistory[]; busy: boolean;
    onAction: (item: ImportHistory, verb: 'apply' | 'undo' | 'reconcile' | 'status') => Promise<void>;
    onRefresh: () => Promise<void>; onCleanup: () => Promise<void>;
};
const reversed = ['undone', 'rolled_back'];
export function ImportJobs({ jobs, busy, onAction, onRefresh, onCleanup }: Props) {
    return <section><h2>Import jobs</h2>
        <p>Progress survives closing this page and restarting the application. Undo removes only unchanged records owned by that import; later live work or references stop removal.</p>
        {jobs.length === 0 ? <p>No reviewed imports yet.</p> : jobs.map(item => {
            const state = item.job?.state ?? item.state, checkpoint = item.job?.checkpoint ?? item.checkpoint, total = item.job?.total ?? item.total;
            const channels = item.summary?.channels?.map((channel: any) => channel.name).join(', ');
            return <article className="import-job" key={item.planId ?? item.review ?? item.jobId}>
                <h3>{channels || item.namespace}</h3>
                <p>{state}{total !== undefined && checkpoint !== undefined ? ` · ${checkpoint} / ${total} source entries` : ''}</p>
                {total !== undefined && checkpoint !== undefined && <progress value={checkpoint} max={Math.max(1, total)} aria-label="Imported source entries" />}
                {item.summary?.delta && <DeltaReport delta={item.summary.delta} />}
                {item.summary?.attestation && <AttestationReport attestation={item.summary.attestation} />}
                {item.summary?.delta && reversed.includes(state) && <p>Delta pass {state === 'undone' ? 'undone' : 'rolled back'}. Its reversible imported changes were withdrawn; native work remains.</p>}
                {item.caption && <p className="import-approval">{item.caption}</p>}
                {item.legacy && <p>Legacy import · guarded Undo only. To import new history, select a local export and review a new dry run.</p>}
                {(item.error || item.failureCode || item.job?.error) && <p className="import-error">{item.error || item.job?.error || item.failureCode}</p>}
                <code>{item.planId ?? item.review ?? item.jobId}</code>
                <div className="import-actions">
                    {!item.legacy && item.planId && <>
                        <button disabled={busy} onClick={() => void onAction(item, 'status')}>Check status</button>
                        {['queued', 'applying'].includes(state) && <button className="import-primary" disabled={busy} onClick={() => void onAction(item, 'apply')}>Resume reviewed import</button>}
                        {['undoing', 'rolling_back'].includes(state) && <button disabled={busy} onClick={() => void onAction(item, 'undo')}>Resume Undo</button>}
                        {state === 'completed' && <button disabled={busy} onClick={() => void onAction(item, 'reconcile')}>Reconcile imported history</button>}
                    </>}
                    {!reversed.includes(state) && (item.planId || item.legacy && item.review && item.job) && <button disabled={busy || item.legacy && !item.reversalSafe} onClick={() => void onAction(item, 'undo')}>{item.legacy ? 'Undo legacy import' : 'Undo this import'}</button>}
                    {item.legacy && !item.reversalSafe && !reversed.includes(state) && <p role="note">Undo is unavailable because later activity, member changes or newer history in these conversations depend on this import.</p>}
                </div>
            </article>;
        })}
        <button disabled={busy} onClick={() => void onRefresh()}>Refresh progress</button>
        <button disabled={busy} onClick={() => void onCleanup()}>Finish pending file cleanup</button>
    </section>;
}
