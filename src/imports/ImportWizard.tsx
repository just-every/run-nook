import { useEffect, useState } from 'react';
import { MappingForm } from './MappingForm';
import { ImportJobs } from './ImportJobs';
import { ReviewPanel } from './ReviewPanel';
import '../brand/tokens.css';
import './imports.css';
import '../brand/controls.css';
async function api(path: string, body?: any, zip?: File) { const response = await fetch('/api/slack-imports' + path, { method: body !== undefined || zip ? 'POST' : 'GET', headers: zip ? { 'Content-Type': 'application/zip' } : body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: zip ?? (body !== undefined ? JSON.stringify(body) : undefined) }); const value: any = await response.json(); if (!response.ok)
    throw new Error(value.error || 'Import request failed'); return value; }
export function ImportWizard({ initial }: any) {
    const [source, setSource] = useState<any>(null), [review, setReview] = useState<any>({ namespace: '', channels: [], actors: {}, acceptedOmissions: [] }), [preview, setPreview] = useState<any>(null), [accepted, setAccepted] = useState(false), [jobs, setJobs] = useState(initial.jobs), [busy, setBusy] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('');
    // A ZIP chosen before the page is live would be dropped silently; the picker opens once it can be handled.
    const [live, setLive] = useState(false);
    useEffect(() => setLive(true), []);
    const work = async (label: string, fn: () => Promise<void>) => { setBusy(label); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed');
    }
    finally {
        setBusy('');
    } };
    const refresh = async () => setJobs((await api('')).jobs);
    const upload = async (file: File) => work('Reading local ZIP', async () => { const result = await api('/upload', undefined, file); setSource(result); setPreview(null); setAccepted(false); setReview({ namespace: '', channels: [], actors: {}, acceptedOmissions: [] }); setStatus('ZIP received. Select channels, audiences, and actor decisions.'); });
    const makePreview = async () => work('Checking preview', async () => { const acceptedOmissions = accepted && preview ? [preview.omissionDigest] : []; setPreview(null); const next = await api('/preview', { upload: source.upload, review: { ...review, acceptedOmissions } }); setPreview(next); setStatus(next.blocked ? 'Import blocked. Deselect affected channels or upload a corrected export.' : next.needsOmissionReview ? 'Review the omissions, then preview again to bind your approval.' : 'Exact plan ready for approval.'); await refresh(); });
    const action = async (id: string, verb: string, fingerprint?: string) => work(verb === 'undo' ? 'Undoing guarded historical import' : 'Applying historical import', async () => { let result = await api(`/${id}/${verb}`, { fingerprint });
        // Apply first stages the export's files, a bounded chunk per request; the job starts once all are ready.
        for (let last = -1; !result.job && result.files && result.files.staged !== last;) { last = result.files.staged; result = await api(`/${id}/apply`, { fingerprint }); }
        if (!result.job) { setStatus(`Files staged: ${result.files.staged} of ${result.files.total}. Use Apply reviewed plan to continue.`); await refresh(); return; }
        // A request applies one durable batch within the platform's query budget; keep
        // going, forward or in reverse, while this page is open. Resume continues after any interruption.
        // Reversal leaves the checkpoint in place, so each committed batch is recognised by its fence.
        const progress = (job: { state: string; checkpoint: number; fence: number }) => `${job.state}:${job.checkpoint}:${job.fence}`;
        for (let last = ''; !['completed', 'undone', 'rolled_back'].includes(result.job.state) && progress(result.job) !== last;) { last = progress(result.job); result = await api(`/${id}/${['undoing', 'rolling_back'].includes(result.job.state) ? 'undo' : 'resume'}`, {}); }
        setStatus(`Import ${result.job.state}: ${result.job.checkpoint} of ${result.job.total} source entries. ${['completed', 'undone', 'rolled_back'].includes(result.job.state) ? '' : 'Use Resume to continue the next durable batch.'}`); await refresh(); });
    // Once an exact plan is ready, applying it is the step's one forward action; until then it is previewing.
    const planReady = !!preview && !preview.blocked && !!preview.fingerprint;
    return <main className="imports-page"><header><a className="import-back" href="/app">← Back to conversations</a><p className="import-eyebrow">Workspace owner</p><h1>Bring your Slack history into Nook</h1><p>Upload a local export ZIP, review its limits, and choose who can read each new private channel.</p></header>
 <div role="alert" className={error ? 'import-error' : ''}>{error}</div><p role="status" aria-live="polite">{busy || status}</p>
 <section><h2>1. Upload a local Slack export</h2><label>Slack export ZIP<input type="file" accept=".zip,application/zip" disabled={!!busy || !live} onChange={e => { const file = e.target.files?.[0]; if (file)
        void upload(file); }}/></label><p className="import-lead">ZIPs stay in owner custody.</p><details className="import-more"><summary>How your export is handled</summary><p>This importer makes no Slack or source URL requests. Public-channel JSON and supplied file bytes are supported; private channels and direct messages are excluded. Unsupported event types in a selected channel block the import.</p></details></section>
 {source && <form onSubmit={e => { e.preventDefault(); void makePreview(); }}><h2>2. Choose destinations and identities</h2><button type="button" disabled={!!busy} onClick={() => void work('Discarding owner upload', async () => { await api(`/uploads/${source.upload}`, {}); setSource(null); setPreview(null); await refresh(); setStatus('Raw upload discarded.'); })}>Discard unused raw upload</button><MappingForm source={source} review={review} setReview={(value: any) => { setReview(value); setPreview(null); setAccepted(false); }}/>{preview && <ReviewPanel preview={preview} accepted={accepted} onAccept={setAccepted} withoutMissingFiles={review.importWithoutMissingFiles === true} onMissingFiles={(choice: boolean) => { setReview({ ...review, importWithoutMissingFiles: choice }); setPreview({ ...preview, fingerprint: undefined }); setStatus('Preview again to review your missing-file choice.'); }}/>}<button className={planReady ? '' : 'import-primary'} disabled={!!busy || !review.channels.length} type="submit">{preview?.needsOmissionReview ? 'Confirm omissions and preview again' : 'Preview exact import'}</button>{!preview?.blocked && preview?.fingerprint && <button type="button" className="import-primary" disabled={!!busy} onClick={() => void action(preview.review, 'apply', preview.fingerprint)}>Apply reviewed plan</button>}</form>}
 <ImportJobs jobs={jobs} busy={!!busy} onAction={action}
    onReviewAgain={id => work('Preparing a fresh review', async () => { const next = await api(`/${id}/review`, {}); setSource(next.source); setReview(next.review); setPreview(null); setAccepted(false); setStatus('Review the current audience and actor choices, then preview and approve the new plan.'); })}
    onRelease={id => work('Releasing reversed import upload', async () => { await api(`/uploads/${id}`, {}); if (source?.upload === id) { setSource(null); setPreview(null); } await refresh(); setStatus('Upload released. Upload the ZIP again and review current audiences to approve a fresh plan.'); })}
    onRefresh={() => work('Refreshing jobs', refresh)}
    onCleanup={() => work('Finishing file cleanup', async () => { await api('/cleanup', {}); setStatus('Durable file cleanup checked.'); })}/>

 </main>;
}
