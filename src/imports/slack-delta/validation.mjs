import { canonicalPath } from '../zip.mjs';

export const invalid = reason => { throw Error(`SLACK_INVALID: delta ${reason}`); };
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const id = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
export const timestamp = value => typeof value === 'string' && /^\d{1,12}\.\d{6}$/.test(value);
export const text = value => typeof value === 'string' && value.isWellFormed() && value.length <= 100000;

export function sourceContext(context, indexed = true) {
    if (!object(context) || !id(context.namespace) || !id(context.channel)
        || typeof context.archiveDigest !== 'string' || !/^[a-f0-9]{64}$/.test(context.archiveDigest)
        || typeof context.entryPath !== 'string'
        || indexed && (!Number.isSafeInteger(context.recordIndex) || context.recordIndex < 0)) invalid('source context');
    canonicalPath(context.entryPath);
    if (!/^[^/]+\/\d{4}-\d{2}-\d{2}\.json$/.test(context.entryPath)) invalid('conversation entry');
    return {
        namespace: context.namespace, channel: context.channel,
        archiveDigest: context.archiveDigest, entryPath: context.entryPath,
        ...(indexed ? { recordIndex: context.recordIndex } : {})
    };
}
