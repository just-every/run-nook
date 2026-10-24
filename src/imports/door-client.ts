export type ImportSource = 'slack' | 'campfire' | 'mattermost' | 'gchat';
export const sourceNames: Record<ImportSource, string> = { slack: 'Slack', campfire: 'Campfire', mattermost: 'Mattermost', gchat: 'Google Chat' };
export type DoorJob = { id: string; state: string; checkpoint: number; total: number; fence: number; error?: string | null };
export type ImportHistory = {
    planId?: string; jobId: string; namespace: string; sourceType: ImportSource;
    state: string; fingerprint: string; caption?: string; legacy?: boolean; review?: string; sourceNamespace?: string;
    summary?: any; job?: DoorJob; checkpoint?: number; total?: number; reversalSafe?: boolean;
    error?: string | null; failureCode?: string | null;
};
export type BusinessSettings = { enabled: boolean; revokedKeys: string[] };
export type DoorPlan = {
    planId: string; fingerprint: string; expiresAt: string;
    summary: Record<string, number>; counts: Record<string, number>;
    rejected: { kind: string; sourceId: string; reason: string }[];
    diagnostics: unknown[]; differences: Record<string, string[]>;
};

export class ImportRequestError extends Error {
    constructor(message: string, readonly details?: unknown) { super(message); }
}

export async function doorRequest(source: ImportSource, action: string, body: unknown = {}, namespace?: string): Promise<any> {
    return request(source, `/api/operator/import/${action}`, body, namespace);
}
export async function readHistory(source: ImportSource): Promise<{ jobs: ImportHistory[]; business: BusinessSettings }> {
    return request(source, `/api/operator/import/history?source=${source}`);
}
async function request(source: ImportSource, url: string, body?: unknown, namespace?: string) {
    const response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
        headers: { 'X-Import-Source': source, ...(namespace === undefined ? {} : { 'X-Import-Namespace': namespace }), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await response.json() as any;
    if (!response.ok) throw new ImportRequestError(value.error, value.details);
    return value;
}

const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), byte => byte.toString(16).padStart(2, '0')).join('');
function base64(bytes: Uint8Array) {
    let binary = '';
    for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
    return btoa(binary);
}
export async function uploadPacket(source: ImportSource, packet: unknown, onProgress: (done: number, total: number, uploadId: string) => void, namespace: string) {
    const bytes = new TextEncoder().encode(JSON.stringify(packet));
    const bundleSha256 = await digest(bytes), totalChunks = Math.ceil(bytes.length / 65536);
    let uploadId: string | undefined;
    for (let index = 0; index < totalChunks; index++) {
        const chunk = bytes.subarray(index * 65536, (index + 1) * 65536);
        const result = await doorRequest(source, 'uploads', {
            uploadId, name: `${source}-reviewed-history.json`, bundleSha256,
            totalBytes: bytes.length, totalChunks, index, chunkSha256: await digest(chunk), base64: base64(chunk),
        }, namespace);
        uploadId = result.uploadId;
        onProgress(index + 1, totalChunks, uploadId!);
    }
    return uploadId!;
}

const terminal = ['completed', 'failed', 'undone', 'rolled_back'];
export async function continueJob(source: ImportSource, action: 'apply' | 'undo' | 'legacy-undo', body: unknown, onProgress: (job: DoorJob) => void, namespace?: string, onFiles?: (done: number, total: number) => void) {
    let previous = '', staged = -1;
    for (;;) {
        const result = await doorRequest(source, action, body, namespace);
        if (!result.job) {
            if (action === 'apply' && result.files) {
                onFiles?.(result.files.staged, result.files.total);
                if (result.files.staged !== staged) { staged = result.files.staged; continue; }
            }
            return result;
        }
        const job = result.job as DoorJob;
        onProgress(job);
        if (job.error) throw new ImportRequestError(job.error);
        const progress = `${job.state}:${job.checkpoint}:${job.fence}`;
        if (terminal.includes(job.state) || progress === previous) return result;
        previous = progress;
    }
}
