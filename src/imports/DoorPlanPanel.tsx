import type { DoorPlan } from './door-client';

export function ImportCounts({ counts }: { counts: Record<string, unknown> }) {
    const entries = Object.entries(counts).flatMap(([name, count]) => count && typeof count === 'object' ? Object.entries(count).map(([kind, total]) => [`${kind} records`, total] as const) : [[name, count] as const]);
    return <dl className="import-counts">{entries.map(([name, count]) => <div key={name}><dt>{name.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd>{String(count)}</dd></div>)}</dl>;
}
export function DoorPlanPanel({ plan, expired }: { plan: DoorPlan; expired: boolean }) {
    return <section aria-labelledby="import-plan-title"><h2 id="import-plan-title">3. Review the dry run</h2>
        <p>The dry run makes no changes to conversations. Review the server’s counts, rejections and differences before applying it.</p>
        <ImportCounts counts={plan.summary} /><ImportCounts counts={plan.counts} />
        <h3>Rejected source records</h3>{plan.rejected.length ? <ul className="import-omissions">{plan.rejected.map((row, index) => <li key={index}><strong>{row.kind}</strong><code>{row.sourceId}</code><span>{row.reason}</span></li>)}</ul> : <p>No rejected source records.</p>}
        <h3>Differences from retained history</h3>{Object.entries(plan.differences).map(([kind, rows]) => <details key={kind}><summary>{kind}: {rows.length}</summary><ul className="import-omissions">{rows.map((row, index) => <li key={index}><code>{row}</code></li>)}</ul></details>)}
        {!!plan.diagnostics.length && <details><summary>Plan diagnostics</summary><pre className="import-json">{JSON.stringify(plan.diagnostics, null, 2)}</pre></details>}
        <p className="import-digest">Reviewed plan <code>{plan.fingerprint}</code></p>
        <p>{expired ? 'This dry run has expired. Create a new dry run and review it before applying.' : `This dry run expires at ${new Date(plan.expiresAt).toLocaleString()}. Dry runs last 30 minutes.`}</p>
    </section>;
}

export function ReconciliationPanel({ report, onClose }: { report: any; onClose: () => void }) {
    const { byKind, ...counts } = report.counts;
    return <section><h2>Reconciliation</h2><p>{report.ok ? 'Every source record is present or has an explanation.' : 'Native history differs from this import. Review each mismatched source record.'}</p>
        <ImportCounts counts={counts} />{byKind && <ImportCounts counts={byKind} />}
        <ul className="import-omissions">{report.sourceIds.map((row: any, index: number) => <li key={index}><strong>{row.kind}: {row.status}</strong><code>{row.sourceId}</code>{row.reason && <span>{row.reason}</span>}{row.conflicts?.map((conflict: string) => <code key={conflict}>{conflict}</code>)}</li>)}</ul>
        <p className="import-digest">Reconciled plan <code>{report.fingerprint}</code></p><button type="button" onClick={onClose}>Close reconciliation</button>
    </section>;
}
