import { context, type StorageBindings } from '../platform/storage/context';
import { localUpload, cleanupImportObjects, discardUpload } from './custody.ts';
import { inspectUpload, previewImport, applyReviewed, resumeReviewed, importStatus, undoReviewed, reviewAgain } from './service.ts';
import { listImports } from './list.ts';
import { Fault, fail } from '../family/team-chat/domain';
import { metered } from './request-budget.ts';
export async function slackImportRoute(request: Request, env: StorageBindings): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/slack-imports' && !url.pathname.startsWith('/api/slack-imports/'))
        return null;
    try {
        // Every statement this request runs, sign-in included, counts toward its budget.
        const c = await context({ ...env, DB: metered(env.DB) }, request.headers), parts = url.pathname.split('/').filter(Boolean);
        let result: any;
        if (request.method !== 'GET' && request.headers.get('origin') !== url.origin)
            fail(403, 'Origin required');
        if (request.method === 'POST' && parts.length === 3 && parts[2] === 'upload') {
            if (request.headers.get('content-type') !== 'application/zip')
                fail(415, 'ZIP required');
            result = await inspectUpload(c, await localUpload(c, request));
        }
        else {
            let body: any = {};
            if (request.method !== 'GET') {
                if (request.headers.get('content-type') !== 'application/json')
                    fail(415, 'JSON required');
                const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
                let length = 0;
                if (reader)
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        length += value.length;
                        if (length > 256 * 1024) {
                            await reader.cancel();
                            fail(413, 'Review too large');
                        }
                        chunks.push(value);
                    }
                try {
                    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
                }
                catch {
                    fail(400, 'Invalid JSON');
                }
            }
            if (parts.length === 2 && request.method === 'GET')
                result = await listImports(c);
            else if (parts.length === 3 && parts[2] === 'preview' && request.method === 'POST')
                result = await previewImport(c, body);
            else if (parts.length === 3 && parts[2] === 'cleanup' && request.method === 'POST')
                result = { removed: await cleanupImportObjects(c) };
            else if (parts.length === 3 && request.method === 'GET')
                result = await importStatus(c, parts[2]);
            else if (parts.length === 4 && parts[2] === 'uploads' && request.method === 'POST')
                result = await discardUpload(c, parts[3]);
            else if (parts.length === 4 && request.method === 'POST') {
                if (parts[3] === 'review')
                    result = await reviewAgain(c, parts[2]);
                else if (parts[3] === 'apply')
                    result = await applyReviewed(c, parts[2], body.fingerprint);
                else if (parts[3] === 'resume')
                    result = await resumeReviewed(c, parts[2]);
                else if (parts[3] === 'undo')
                    result = await undoReviewed(c, parts[2]);
            }
        }
        if (result === undefined)
            fail(404, 'Import route unavailable');
        return Response.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed', status = error instanceof Fault ? error.status : /^(ZIP_REJECTED|SLACK_INVALID)/.test(message) ? 400 : /(IMPORT_|PLAN_|JOB_|REVIEW_|SOURCE_|TARGET_|CONFLICT|constraint)/.test(message) ? 409 : 500;
        return Response.json({ error: status === 500 ? 'Import failed; retry the same reviewed job' : message }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
}
