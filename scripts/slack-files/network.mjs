import { SLACK_FILE_LIMIT } from '../../src/imports/policy.mjs';
import { ZIP_LIMITS, sha256 } from '../../src/imports/zip.mjs';
import { fail } from './errors.mjs';

// Slack's documented private download host. Deliberately no wildcard/CDN or
// external-file host: https://docs.slack.dev/messaging/working-with-files/
export function admittedUrl(value) {
    let url;
    try { url = new URL(value); } catch { fail('invalid-file-link'); }
    if (url.protocol !== 'https:' || url.hostname !== 'files.slack.com' || url.port || url.username || url.password || url.hash) fail('file-host-refused');
    return url;
}

export async function download(item, token, budget, transport = fetch) {
    let url = admittedUrl(item.url);
    const maximum = Math.min(item.size ?? SLACK_FILE_LIMIT, SLACK_FILE_LIMIT, ZIP_LIMITS.total - budget.used);
    const signal = AbortSignal.timeout(30_000);
    for (let redirects = 0; redirects <= 5; redirects++) {
        // Always validate before constructing/sending authorization, including redirects.
        admittedUrl(url.href);
        let response;
        try {
            response = await transport(url.href, { redirect: 'manual', signal, headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity' } });
        } catch { fail('download-interrupted'); }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            await response.body?.cancel();
            if (!location || redirects === 5) fail('redirect-limit');
            let next;
            try { next = new URL(location, url); } catch { fail('invalid-redirect'); }
            url = admittedUrl(next.href);
            continue;
        }
        if (response.status !== 200) { await response.body?.cancel(); fail('download-http-error'); }
        const length = response.headers.get('content-length'), encoding = response.headers.get('content-encoding');
        if (!response.body || encoding && encoding !== 'identity' || length !== null && (!/^\d+$/.test(length) || Number(length) > maximum || item.size !== null && Number(length) !== item.size)) {
            await response.body?.cancel(); fail('download-size-or-encoding');
        }
        const reader = response.body.getReader(), chunks = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                budget.used += value.byteLength;
                if (size > maximum || budget.used > ZIP_LIMITS.total) fail('download-byte-limit');
                chunks.push(Buffer.from(value));
            }
        } catch (error) {
            await reader.cancel().catch(() => {});
            if (error?.code === 'download-byte-limit') throw error;
            fail('download-interrupted');
        } finally { reader.releaseLock(); }
        const bytes = Buffer.concat(chunks);
        if (!size || item.size !== null && size !== item.size) fail('download-size-mismatch');
        if (bytes.includes(Buffer.from(token))) fail('credential-in-response');
        if (item.sha256 !== null && sha256(bytes) !== item.sha256) fail('download-digest-mismatch');
        return bytes;
    }
    fail('redirect-limit');
}
