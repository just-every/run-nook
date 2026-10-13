import { d1RequestContext, remaining, reserveReturn, type D1ImportContext, type ImportAction } from './kit.ts';
import { left } from './request-budget.ts';
import { authority, authFence, type Context } from '../platform/storage/context';
import { importTargets } from './target.ts';
import { MAPPING_VERSION } from './ids.mjs';
import { retainedChannelHistory } from './channel-guard.ts';

// Reading progress and reversing owned effects do not disclose history to a new
// audience. They retain current owner/session/Team authority and the immutable
// review binding. Only forward work requires every reviewed operator version.
export function importPredicate(c: Context, review: any, action: ImportAction) {
    const parts = [authority, authFence,
        "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner')",
        "EXISTS(SELECT 1 FROM nook_import_reviews WHERE id=? AND owner=? AND state<>'discarded' AND fingerprint IS ? AND authority_json=? AND channels_json=?)"];
    const params: any[] = [...c.credentials, c.uid, review.id, c.uid, review.fingerprint ?? null, review.authority_json, review.channels_json];
    if (action === 'read') return { sql: parts.join(' AND '), params };
    parts.push("EXISTS(SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND (state='ready' OR state='discarded' AND ?=1 AND EXISTS(SELECT 1 FROM ik_jobs WHERE id=? AND fingerprint=? AND operation_key=? AND destination=? AND principal_id=? AND namespace=? AND mapping_version=?)))");
    params.push(review.upload, c.uid, review.savedCustody ? 1 : 0, review.kit_job ?? null, review.currentFingerprint ?? review.fingerprint ?? null, review.id, c.uid, c.uid, review.namespace, MAPPING_VERSION);
    if (action === 'undo' || action === 'rollback') {
        // Base additionally matches each retained before-image and provenance
        // revision. Product native work or any audience change blocks cleanup.
        parts.push(`NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_conversations cv ON cv.id=ch.conversation WHERE ch.job=? AND (cv.seq<>(SELECT COUNT(*) FROM nook_events e WHERE e.conversation=cv.id AND e.kind='erasure' AND e.actor IS NULL) OR cv.version<>1 OR cv.message_count<>0 OR ${retainedChannelHistory('cv.id')}))`);
        params.push(review.domain_job);
    } else {
        parts.push(`NOT EXISTS(SELECT 1 FROM json_each(?) a WHERE NOT EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access access ON access.user=o.id WHERE o.id=json_extract(a.value,'$.id') AND o.status='active' AND o.version=json_extract(a.value,'$.version') AND access.active=1 AND access.mode=json_extract(a.value,'$.mode') AND access.generation=json_extract(a.value,'$.generation')) AND NOT (json_extract(a.value,'$.id') IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=json_extract(a.value,'$.id'))))`);
        params.push(review.authority_json, JSON.stringify(review.erasedAssociations ?? []));
        if (action !== 'plan') {
            // Targets may already be gone while the old product envelope and
            // cleanup are still pending. A new approval cannot publish into it.
            parts.push(`NOT EXISTS(SELECT 1 FROM nook_import_reviews prior LEFT JOIN ik_jobs old ON old.operation_key=prior.id AND old.principal_id=prior.owner WHERE prior.domain_job=? AND prior.id<>? AND (prior.state NOT IN ('reviewed','discarded','undone') OR old.id IS NOT NULL AND (prior.state<>'undone' OR old.state NOT IN ('undone','rolled_back'))))`);
            params.push(review.domain_job, review.id);
            parts.push('NOT EXISTS(SELECT 1 FROM nook_imports WHERE id=? AND (owner<>? OR intent<>? OR plan_digest<>?))');
            params.push(review.domain_job, c.uid, review.id, review.fingerprint ?? null);
            parts.push("NOT EXISTS(SELECT 1 FROM nook_import_objects o WHERE o.owner=? AND substr(o.object_key,1,length(?))=? AND (o.state='deleting' OR EXISTS(SELECT 1 FROM nook_object_deletes d WHERE d.object_key=o.object_key)))");
            const prefix = `private/imports/${c.uid}/${review.upload}/files/${review.domain_job}/${review.id}/`;
            params.push(c.uid, prefix, prefix);
        }
    }
    parts.push(`NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_conversations cv ON cv.id=ch.conversation WHERE ch.job=? AND (cv.owner<>? OR cv.kind<>'private' OR (SELECT COUNT(*) FROM nook_members m WHERE m.conversation=ch.conversation)<>(SELECT COUNT(*) FROM json_each(?) x,json_each(json_extract(x.value,'$.members')) a WHERE json_extract(x.value,'$.sourceId')=ch.source_id AND NOT EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=a.value)) OR EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=ch.conversation AND NOT EXISTS(SELECT 1 FROM json_each(?) x,json_each(json_extract(x.value,'$.members')) a WHERE json_extract(x.value,'$.sourceId')=ch.source_id AND a.value=m.user AND NOT EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=a.value)))))`);
    params.push(review.domain_job, c.uid, review.channels_json, review.channels_json);
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
    const context: D1ImportContext = { destination: c.uid, namespace: review.namespace, mappingVersion: MAPPING_VERSION, operationKey: review.id, batchSize: 100, maxBatches: 20, reviewedFingerprint: review.currentFingerprint ?? review.fingerprint ?? undefined, storage: { database, targets: importTargets() }, authorization: { principalId: c.uid, predicate: action => importPredicate(c, review, action) } };
    return reserveReturn(context, remaining(context) - (left(c) - tail));
}
