import { useEffect, useRef, useState } from 'react';
import { inspectLocal, prepareLocal, releaseLocal } from './local-source';
import { BusinessImports } from './BusinessImports';
import { DoorPlanPanel, ReconciliationPanel } from './DoorPlanPanel';
import { ImportJobs } from './ImportJobs';
import { DeltaReport } from './DeltaReport';
import { AttestationReport } from './AttestationReport';
import { CutoverInvitations } from './CutoverInvitations';
import { attestedRange, recordAttestation } from './attestation.mjs';
import { ReviewPanel } from './ReviewPanel';
import { SourceInstructions } from './SourceInstructions';
import { SourceMapping, mappingReady } from './SourceMapping';
import { continueJob, doorRequest, ImportRequestError, readHistory, sourceNames, uploadPacket } from './door-client';
import type { BusinessSettings, DoorJob, DoorPlan, ImportHistory, ImportSource } from './door-client';
import '../brand/tokens.css';
import './imports.css';
import '../brand/controls.css';

type Initial = { owner: string; users: any[]; jobs: ImportHistory[]; business: BusinessSettings };
const emptyReview = (kind: ImportSource): any => ({ namespace: '', actors: {}, acceptedOmissions: [], ...(['slack','gchat'].includes(kind) ? { channels: [] } : kind === 'mattermost' ? { roles: {} } : {}) });
export function DoorWizard({ initial, kind }: { initial: Initial; kind: ImportSource }) {
    const [source, setSource] = useState<any>(null), [review, setReview] = useState<any>(() => emptyReview(kind));
    const [summary, setSummary] = useState<any>(null), [accepted, setAccepted] = useState(false), [plan, setPlan] = useState<DoorPlan | null>(null);
    const [jobs, setJobs] = useState(initial.jobs.filter(job => job.sourceType === kind)), [business, setBusiness] = useState(initial.business);
    const [busy, setBusy] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState<Error | null>(null);
    const [report, setReport] = useState<any>(null), [currentJob, setCurrentJob] = useState<DoorJob | null>(null), [catchup, setCatchup] = useState(false);
    const [overlapDays, setOverlapDays] = useState(7), [deltaBaseline, setDeltaBaseline] = useState<any>(null);
    const [range, setRange] = useState({from: '', to: ''});
    const [live, setLive] = useState(false), [now, setNow] = useState(Date.now()), [stale, setStale] = useState(false);
    const retained = useRef<{ uploadId: string; planId?: string; namespace: string; started?: boolean } | null>(null);
    useEffect(() => { setLive(true); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
    useEffect(() => () => { if (source?.handle) releaseLocal(source.handle); }, [source?.handle]);
    const vendor = sourceNames[kind], expired = !!plan && now >= Date.parse(plan.expiresAt);
    const work = async (label: string, action: () => Promise<void>) => {
        setBusy(label); setError(null);
        try { await action(); } catch (value) { setError(value instanceof Error ? value : new Error(String(value))); }
        finally { setBusy(''); }
    };
    const refresh = async () => { const result = await readHistory(kind); setJobs(result.jobs); setBusiness(result.business); };
    const change = (next: any) => { setReview(next); setDeltaBaseline(null); setSummary(null); setStale(false); setAccepted(false); setPlan(null); setCurrentJob(null); setReport(null); };
    // The missing-files choice lives inside the review, so the review stays on screen with the choice shown and waits for the next preview.
    const chooseMissingFiles = (choice: boolean) => {
        setReview({ ...review, importWithoutMissingFiles: choice }); setStale(true); setAccepted(false); setPlan(null); setCurrentJob(null); setReport(null);
        setStatus('Preview again to bind this file choice to the reviewed plan.');
    };
    const withdraw = async () => {
        if (retained.current && !retained.current.started) {
            const { namespace, uploadId, planId } = retained.current;
            await doorRequest(kind, 'withdraw', { uploadId, planId }, namespace);
        }
        retained.current = null;
    };
    const inspect = (file: File) => work(`Reading local ${vendor} export`, async () => {
        await withdraw();
        setSource(null); change(emptyReview(kind)); setStatus(''); setCatchup(false); setOverlapDays(7); setRange({from: '', to: ''});
        const next = await inspectLocal(file, kind, initial.users);
        setSource({ ...next, owner: initial.owner, users: initial.users });
        setReview({ ...emptyReview(kind), actors: kind === 'slack' ? {} : Object.fromEntries(next.actors.map((actor: any) => [actor.sourceId, null])) });
        setStatus(kind === 'slack' ? 'Select channels, audiences, and people. The export is still on your computer.' : 'Map every participant to an existing Nook member and review the original audiences. The export is still on your computer.');
    });
    const reviewedSource = async (next: any) => {
        if (kind !== 'slack' || !catchup) { const { delta, ...ordinary } = next; return ordinary; }
        if (!Number.isInteger(overlapDays) || overlapDays < 1 || overlapDays > 12000000) throw new Error('Choose an overlap of at least one day, up to the full source history.');
        const response = await doorRequest('slack', 'delta-state', { namespace: review.namespace, sourceIds: review.channels.map((channel: any) => channel.sourceId) }, review.namespace);
        const delta = { overlapDays, baseline: response.baseline };
        setDeltaBaseline(response.baseline);
        setReview((current: any) => ({ ...current, delta }));
        return { ...next, delta };
    };
    const preview = () => work('Checking import', async () => {
        const stated = attestedRange(range.from || range.to ? range : undefined);
        const result = await prepareLocal(source.handle, await reviewedSource({ ...review, acceptedOmissions: [] }), initial.owner, initial.users);
        setSummary({...result.summary, ...(stated ? {attestation: recordAttestation(stated, {id: initial.owner, name: initial.users.find(user => user.id === initial.owner).name}, Date.now())} : {})}); setStale(false); setPlan(null); setAccepted(false); setCurrentJob(null);
        setStatus(result.summary.blocked ? 'Import blocked. Review the source issues below.' : 'Review the historical import and its exact omissions before creating a dry run.');
    });
    const createPlan = () => work('Creating reviewed dry run', async () => {
        const stated = attestedRange(range.from || range.to ? range : undefined);
        const nextReview = { ...review, acceptedOmissions: accepted ? [summary.omissionDigest] : [] };
        const result = await prepareLocal(source.handle, await reviewedSource(nextReview), initial.owner, initial.users);
        setSummary({...result.summary, ...(stated ? {attestation: recordAttestation(stated, {id: initial.owner, name: initial.users.find(user => user.id === initial.owner).name}, Date.now())} : {})});
        if (result.summary.blocked || result.summary.needsOmissionReview) { setStatus('Review and accept the exact omissions before creating a dry run.'); return; }
        await withdraw();
        const namespace = review.namespace;
        const uploadId = await uploadPacket(kind, result.packet, (done, total, id) => {
            retained.current = { uploadId: id, namespace };
            setBusy(`Uploading reviewed history: ${done} of ${total} chunks`);
        }, namespace);
        const next = await doorRequest(kind, 'plan', { uploadId, ...(catchup ? { catchup: true } : {}), ...(stated ? {attestation: stated} : {}), ...(result.summary.cutover ? {cutover: result.summary.cutover} : {}) }, namespace);
        retained.current = { uploadId, namespace, planId: next.planId };
        setPlan(next); setCurrentJob(null); setNow(Date.now());
        setStatus('Dry run ready. Review its counts, rejections and differences before applying.');
    });
    const progress = (job: DoorJob) => {
        const message = `Import ${job.state}: ${job.checkpoint} of ${job.total} source entries.`;
        setCurrentJob(job); setBusy(message); setStatus(message);
    };
    const apply = () => work('Applying reviewed historical import', async () => {
        if (retained.current) retained.current.started = true;
        try {
            const result = await continueJob(kind, 'apply', { planId: plan!.planId, reviewedFingerprint: plan!.fingerprint }, progress, review.namespace,
                (done, total) => { setBusy(`Preparing source files: ${done} of ${total}`); setStatus(`Source files prepared: ${done} of ${total}. Apply reviewed plan continues the next batch.`); });
            if (result.job?.state === 'completed') setStatus('Historical import completed. Check the imported records below.');
        } finally { await refresh(); }
    });
    const action = (item: ImportHistory, verb: 'apply' | 'undo' | 'reconcile' | 'status') => work(`${verb === 'undo' ? 'Undoing' : 'Checking'} ${vendor} import`, async () => {
        const historyProgress = (job: DoorJob) => {
            if (item.planId && item.planId === plan?.planId) setCurrentJob(job);
            setStatus(`Import ${job.state}: ${job.checkpoint} of ${job.total} source entries.`);
        };
        if (verb === 'reconcile') setReport(await doorRequest(item.sourceType, 'reconcile', { planId: item.planId }, item.sourceNamespace));
        else if (verb === 'status') {
            const result = await doorRequest(item.sourceType, 'status', { planId: item.planId }, item.sourceNamespace);
            if (result.job) historyProgress(result.job);
            else setStatus('This plan has no applied job.');
        } else {
            const result = await continueJob(item.sourceType, item.legacy ? 'legacy-undo' : verb, item.legacy ? { review: item.review } : {
                planId: item.planId, ...(verb === 'apply' ? { reviewedFingerprint: item.fingerprint } : {}),
            }, historyProgress, item.sourceNamespace);
            if (verb === 'undo' && item.planId === plan?.planId) { setPlan(null); retained.current = null; }
            if (result.state === 'cancelled') setStatus('Unapplied dry run cancelled.');
        }
        await refresh();
    });
    const hasOmissions = !!summary?.omissions.length;
    return <main className="imports-page"><header><a className="import-back" href="/app">← Back to conversations</a><p className="import-eyebrow">Workspace owner</p><h1>Bring your {vendor} history into Nook</h1>
        <nav aria-label="Other import sources">{(['slack', 'campfire', 'mattermost','gchat'] as const).filter(sourceKind => sourceKind !== kind).map(sourceKind => <a key={sourceKind} href={`/imports?source=${sourceKind}`}>Import {sourceNames[sourceKind]} history</a>)}</nav>
        <p>{kind === 'slack' ? 'Upload a local export ZIP, review its limits, and choose who can read each new private channel.' : kind === 'campfire' ? 'Review a consistent Campfire backup, map its people, and keep every room’s original audience.' : kind === 'gchat' ? 'Review spaces, topics and private conversations from a Google Chat Takeout export. Keep the mapped source audiences without creating accounts.' : 'Review teams, channels and private conversations from a Mattermost bulk export. Keep every original audience and map identities without granting source privileges.'}</p>
    </header>
        {error && <div role="alert" className="import-error"><strong>{vendor} import</strong><p>{error.message}</p>{error instanceof ImportRequestError && error.details !== undefined && <pre className="import-json">{JSON.stringify(error.details, null, 2)}</pre>}</div>}
        <p role="status" aria-live="polite">{busy || status}</p>
        <section><h2>1. {kind === 'campfire' ? 'Upload a consistent backup' : `Upload a local ${vendor} export`}</h2><label>{vendor} {kind === 'campfire' ? 'backup' : 'export ZIP'}<input type="file" accept={kind === 'campfire' ? '.tar.gz,.tgz,application/gzip' : '.zip,application/zip'} disabled={!!busy || !live} onChange={event => { const file = event.target.files?.[0]; if (file) void inspect(file); event.target.value = ''; }} /></label><SourceInstructions kind={kind} /></section>
        {source && <form onSubmit={event => { event.preventDefault(); void preview(); }}><h2>2. {kind === 'slack' ? 'Choose destinations and identities' : 'Map identities and review audiences'}</h2>
            <button type="button" disabled={!!busy} onClick={() => void work('Discarding reviewed export', async () => { await withdraw(); setSource(null); change(emptyReview(kind)); setStatus('Local export and unused dry run discarded.'); })}>Discard local export</button>
            <SourceMapping kind={kind} source={source} review={review} onChange={change} busy={!!busy} />
            {kind === 'slack' && <fieldset disabled={!!busy}><legend>attested, not verified</legend>
                <label>Attested from (UTC)<input type="date" min="1970-01-01" max={new Date(now).toISOString().slice(0,10)} value={range.from} onChange={event => {setRange({...range, from: event.target.value}); change(review);}} /></label>
                <label>Attested to (UTC)<input type="date" min="1970-01-01" max={new Date(now).toISOString().slice(0,10)} value={range.to} onChange={event => {setRange({...range, to: event.target.value}); change(review);}} /></label>
            </fieldset>}
            {kind === 'slack' && <label className="import-check"><input type="checkbox" checked={catchup} disabled={!!busy} onChange={event => { setCatchup(event.target.checked); change(review); }} />Update previously imported history</label>}
            {kind === 'slack' && catchup && <label>Overlap in days<input type="number" min={1} max={12000000} step={1} required value={Number.isNaN(overlapDays) ? '' : overlapDays} disabled={!!busy} onChange={event => { setOverlapDays(event.target.valueAsNumber); change(review); }} /><small>Recheck an overlap up to the full source history. Changed source records are reviewed before applying.</small></label>}
            {summary?.delta && <DeltaReport delta={summary.delta} />}
            {summary?.attestation && <AttestationReport attestation={summary.attestation} />}
            {summary?.cutover && <CutoverInvitations cutover={summary.cutover} />}
            {summary?.delta && deltaBaseline && <p>Creating a dry run checks the previous import again.</p>}
            {summary && <fieldset disabled={!!busy}><ReviewPanel kind={kind} preview={summary} accepted={accepted} onAccept={(value: boolean) => { setAccepted(value); setPlan(null); }} withoutMissingFiles={review.importWithoutMissingFiles === true} onMissingFiles={chooseMissingFiles} /></fieldset>}
            <button type="submit" className={summary ? '' : 'import-primary'} disabled={!!busy || !mappingReady(kind, source, review)}>Preview exact import</button>
            {kind !== 'slack' && summary && !summary.blocked && <label className="import-check"><input type="checkbox" checked={catchup} disabled={!!busy} onChange={event => { setCatchup(event.target.checked); setPlan(null); }} />Compare with the previous import from this workspace</label>}
            {summary && !summary.blocked && !stale && (!plan || expired || currentJob?.state === 'failed') && <button type="button" className="import-primary" disabled={!!busy || hasOmissions && !accepted} onClick={() => void createPlan()}>Create dry run</button>}
            {plan && <><DoorPlanPanel plan={plan} expired={expired} /><button type="button" className="import-primary" disabled={!!busy || expired || !!currentJob && ['completed', 'failed', 'undone', 'rolled_back'].includes(currentJob.state)} onClick={() => void apply()}>Apply reviewed plan</button></>}
        </form>}
        {report && <ReconciliationPanel report={report} onClose={() => setReport(null)} />}
        <ImportJobs jobs={jobs} busy={!!busy} onAction={action} onSaveCutover={(item, choices) => work('Saving invitation choices', async () => { await doorRequest('slack', 'cutover-choices', { planId: item.planId, choices }, item.sourceNamespace); await refresh(); setStatus('Invitation choices saved. Nothing was sent.'); })} onRefresh={() => work('Refreshing jobs', refresh)} onCleanup={() => work('Finishing file cleanup', async () => { await doorRequest(kind, 'cleanup'); await refresh(); setStatus('File cleanup checked.'); })} />
        <BusinessImports business={business} busy={!!busy} onEnable={enabled => work('Updating import access', async () => { await doorRequest(kind, 'settings', { enabled }); await refresh(); })} onRevoke={kid => work('Revoking import key', async () => { await doorRequest(kind, 'revocations', { kid }); await refresh(); })} />
    </main>;
}
