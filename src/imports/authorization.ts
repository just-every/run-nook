import { d1RequestContext, remaining, reserveReturn, type D1ImportContext, type ImportAction } from './kit.ts';
import { left } from './request-budget.ts';
import { authority, authFence, type Context } from '../platform/storage/context';
import { importTargets } from './target.ts';
import {mappingVersion} from './formats.mjs';
import { retainedChannelHistory } from './channel-guard.ts';

// Reading progress and reversing owned effects do not disclose history to a new
// audience. They retain current owner/session/Team authority and the immutable
// review binding. Legacy jobs admit only reads and guarded reversal.
export function importPredicate(c: Context, review: any, action: ImportAction) {
    if (!['read','undo','rollback'].includes(action)) return {sql:'0',params:[]};
    const parts = [authority, authFence,
        "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner')",
        "EXISTS(SELECT 1 FROM nook_import_reviews WHERE id=? AND owner=? AND state<>'discarded' AND fingerprint IS ? AND authority_json=? AND channels_json=?)"];
    const params: any[] = [...c.credentials, c.uid, review.id, c.uid, review.fingerprint ?? null, review.authority_json, review.channels_json];
    if (action === 'read') return { sql: parts.join(' AND '), params };
    parts.push("EXISTS(SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND (state='ready' OR state='discarded' AND ?=1 AND EXISTS(SELECT 1 FROM ik_jobs WHERE id=? AND fingerprint=? AND operation_key=? AND destination=? AND principal_id=? AND namespace=? AND mapping_version=?)))");
    params.push(review.upload, c.uid, review.savedCustody ? 1 : 0, review.kit_job ?? null, review.currentFingerprint ?? review.fingerprint ?? null, review.id, c.uid, c.uid, review.namespace, mappingVersion(review));
    if (action === 'undo' || action === 'rollback') {
        // Base additionally matches each retained before-image and provenance
        // revision. Product native work or any audience change blocks cleanup.
        parts.push(`NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_conversations cv ON cv.id=ch.conversation WHERE ch.job=? AND (cv.seq<>(SELECT COUNT(*) FROM nook_events e WHERE e.conversation=cv.id AND e.kind='erasure' AND e.actor IS NULL) OR cv.version<>1 OR cv.message_count<>0 OR ${retainedChannelHistory('cv.id')}))`);
        params.push(review.domain_job);
    }
    const campfire=['campfire','mattermost'].includes(JSON.parse(review.summary_json).sourceType),shape=campfire?`cv.owner<>(SELECT json_extract(x.value,'$.owner') FROM json_each(?,'$.channels') x WHERE json_extract(x.value,'$.sourceId')=ch.source_id) OR cv.kind<>(SELECT json_extract(x.value,'$.kind') FROM json_each(?,'$.channels') x WHERE json_extract(x.value,'$.sourceId')=ch.source_id)`:`cv.owner<>? OR cv.kind<>'private'`;
    parts.push(`NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_conversations cv ON cv.id=ch.conversation WHERE ch.job=? AND (${shape} OR (SELECT COUNT(*) FROM nook_members m WHERE m.conversation=ch.conversation)<>(SELECT COUNT(*) FROM json_each(?) x,json_each(json_extract(x.value,'$.members')) a WHERE json_extract(x.value,'$.sourceId')=ch.source_id AND NOT EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=a.value)) OR EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=ch.conversation AND NOT EXISTS(SELECT 1 FROM json_each(?) x,json_each(json_extract(x.value,'$.members')) a WHERE json_extract(x.value,'$.sourceId')=ch.source_id AND a.value=m.user AND NOT EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=a.value)))))`);
    params.push(review.domain_job, ...(campfire?[review.summary_json,review.summary_json]:[c.uid]), review.channels_json, review.channels_json);
    return { sql: parts.join(' AND '), params };
}
type KitDatabase = D1ImportContext['storage']['database'];
const kitDatabases = new WeakMap<object, KitDatabase>();
// The kit counts only its own statements against its 1,000. One wrapper per
// request is shared by every kit call in it, and each call reserves the rest:
// what Nook and sign-in already ran, the request's 100-statement margin, and
// `tail`, the statements Nook still runs after the kit returns.
export function importContext(c: Context, review: any, tail = 0): D1ImportContext {
    let database = kitDatabases.get(c.db);
    if (!database) kitDatabases.set(c.db, database = d1RequestContext({ storage: { database: c.db } } as unknown as D1ImportContext).storage.database);
    const context: D1ImportContext = { destination: c.uid, namespace: review.namespace, mappingVersion: mappingVersion(review), operationKey: review.id, batchSize: 100, maxBatches: 20, reviewedFingerprint: review.currentFingerprint ?? review.fingerprint ?? undefined, storage: { database, targets: importTargets() }, authorization: { principalId: c.uid, predicate: action => importPredicate(c, review, action) } };
    return reserveReturn(context, remaining(context) - (left(c) - tail));
}
