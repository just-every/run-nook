type Props = {
    jobs: any[]; busy: boolean;
    onAction: (id: string, verb: string, fingerprint?: string) => Promise<void>;
    onReviewAgain: (id: string) => Promise<void>;
    onRelease: (id: string) => Promise<void>;
    onRefresh: () => Promise<void>;
    onCleanup: () => Promise<void>;
};
const terminal = ['completed', 'undone', 'rolled_back'];
const reversing = ['undoing', 'rolling_back', 'undone', 'rolled_back'];
export function ImportJobs({ jobs, busy, onAction, onReviewAgain, onRelease, onRefresh, onCleanup }: Props) {
    return <section><h2>Import jobs</h2>
        <p>Progress survives closing this page and restarting the application. Undo removes only unchanged records owned by that import; later live work or references stop removal.</p>
        {jobs.length === 0 ? <p>No reviewed imports yet.</p> : jobs.map(item => <article className="import-job" key={item.review}>
            <h3>{item.summary.channels.map((c: any) => c.name).join(', ')}</h3>
            <p>{item.job?.state ?? item.state}{item.job ? ` · ${item.job.checkpoint} / ${item.job.total} source entries` : ''}</p>
            {item.job && <progress value={item.job.checkpoint} max={Math.max(1, item.job.total)} aria-label="Imported source entries"/>}
            {item.fingerprint && !item.forwardAuthority && item.state !== 'undone' && <p>Reviewed authority changed or previous import cleanup is incomplete. Forward import is blocked. Undo this import when its audience and native history remain unchanged, then review the retained upload again to approve a fresh plan.</p>}
            {item.job && !item.reversalSafe && item.state !== 'undone' && <p>Cleanup is blocked by changed audience or native work. The imported records remain in place.</p>}
            <code>{item.review}</code>
            <div className="import-actions">
                {!item.job && item.state === 'reviewed' && item.forwardAuthority && <button className="import-primary" disabled={busy} onClick={() => void onAction(item.review, 'apply', item.fingerprint)}>Apply reviewed plan</button>}
                {item.job && (!terminal.includes(item.job.state) || reversing.includes(item.job.state) && item.state !== 'undone') && <button disabled={busy || (!reversing.includes(item.job.state) && !item.forwardAuthority)} onClick={() => void onAction(item.review, reversing.includes(item.job.state) ? 'undo' : 'resume')}>Resume</button>}
                {item.job && !['undone', 'rolled_back'].includes(item.job.state) && <button disabled={busy || !item.reversalSafe} onClick={() => void onAction(item.review, 'undo')}>Undo this import</button>}
                {item.job && !['undone', 'rolled_back'].includes(item.job.state) && !item.reversalSafe && <p role="note">Undo is unavailable because later activity, member changes or newer history in these conversations depend on this import.</p>}
                {item.canReviewAgain && <button disabled={busy} onClick={() => void onReviewAgain(item.review)}>Review this upload again</button>}
                {item.state === 'undone' && <button disabled={busy} onClick={() => void onRelease(item.upload)}>Release upload for a fresh review</button>}
            </div>
        </article>)}
        <button disabled={busy} onClick={() => void onRefresh()}>Refresh progress</button>
        <button disabled={busy} onClick={() => void onCleanup()}>Finish pending file cleanup</button>
    </section>;
}
