import {canonicalJson,sha256} from './kit.ts';
import {assertMattermostFileSize} from './mattermost-effects.mjs';
import {assertCampfireFileSize} from './campfire-effects.mjs';
import { assertSlackFileSize } from './policy.mjs';
const check = (ok, code) => { if (!ok) throw Error(code); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function slackExportRow(table, row) {
    if (table === 'nook_import_uploads' && row.state === 'reserved' || table === 'nook_import_objects' && ['reserved', 'deleting'].includes(row.state) || table === 'nook_import_reviews' && row.state === 'applying' || table === 'ik_jobs' && !['completed', 'undone', 'rolled_back'].includes(row.state)) throw Error('reconcile_pending_slack_import_before_export');
    return row;
}
/** The exact union includes attachments and private owner custody. Nothing in
 * this inventory grants a participant a raw-object download route. */
export async function slackArchiveObjects({ read, manifest }, actors, attachments) {
    const uploads = await read('nook_import_uploads'), objects = await read('nook_import_objects'), inventory = await read('nook_object_inventory'), reviews = await read('nook_import_reviews');
    const doors=await read('nook_door_imports');
    const doorObjects=new Map(doors.map(d=>['door-'+sha256(canonicalJson([d.source_type,d.namespace])).slice(0,40),d]));
    const uploadById = new Map(uploads.map(u => [u.id, u])), keys = new Map();
    const add = (key, size, sha256, mime) => {
        check(typeof key === 'string' && key.startsWith('private/') && Number.isSafeInteger(size) && size > 0 && digest(sha256), 'invalid_slack_object');
        const value = { size, sha256, mime }, prior = keys.get(key);
        check(!prior || JSON.stringify(prior) === JSON.stringify(value), 'conflicting_slack_object_reference'); keys.set(key, value);
    };
    for (const file of attachments) if (file.object_key !== null) add(file.object_key, file.size, file.sha256, file.mime);
    for (const upload of uploads) {
        check(actors.has(upload.owner) && ['ready', 'discarded'].includes(upload.state) && digest(upload.archive_digest) && ['archive.zip','archive.campfire.tar.gz','archive.mattermost.zip'].some(name=>upload.object_key===`private/imports/${upload.owner}/${upload.id}/${name}`), 'invalid_slack_upload');
        check(Number.isSafeInteger(upload.size) && upload.size > 0 && upload.size <= 32 * 1024 * 1024, 'invalid_slack_upload_size');
        if (upload.state === 'ready') add(upload.object_key, upload.size, upload.archive_digest, upload.object_key.endsWith('.tar.gz')?'application/gzip':'application/zip');
    }
    for (const object of objects) {
        const door=doorObjects.get(object.upload);
        if(door){
            const broad=door.source_type!=='slack';
            if(broad)assertCampfireFileSize(object.size);else assertSlackFileSize(object.size);
            check(object.owner===door.owner&&object.object_key.startsWith(`private/imports/${object.owner}/${object.upload}/files/${door.domain_job}/${object.upload}/`)&&['ready','deleted'].includes(object.state)&&digest(object.sha256)&&Number.isSafeInteger(object.size)&&object.size>0&&(broad?/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(object.mime):['text/plain','image/png','image/jpeg','application/pdf'].includes(object.mime)),'invalid_door_file_custody');
            if(object.state==='ready')add(object.object_key,object.size,object.sha256,object.mime);
            continue;
        }
        const upload = uploadById.get(object.upload),campfire=upload?.object_key.endsWith('.tar.gz')||upload?.object_key.endsWith('archive.mattermost.zip');
        if(campfire)assertCampfireFileSize(object.size);else assertSlackFileSize(object.size);
        check(upload && upload.owner === object.owner && object.object_key.startsWith(`private/imports/${object.owner}/${object.upload}/files/`) && ['ready', 'deleted'].includes(object.state) && digest(object.sha256) && Number.isSafeInteger(object.size) && object.size > 0 && (campfire?/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(object.mime):['text/plain','image/png','image/jpeg','application/pdf'].includes(object.mime)), 'invalid_slack_file_custody');
        if (object.state === 'ready') {
            check(upload.state === 'ready'||reviews.some(r=>r.upload===upload.id&&r.kit_job), 'discarded_slack_file_custody');
            add(object.object_key, object.size, object.sha256, object.mime);
        }
    }
    for (const review of reviews) {
        const upload = uploadById.get(review.upload);
        if (review.state !== 'discarded') check(JSON.parse(review.summary_json).archiveDigest === upload?.archive_digest, 'slack_review_archive_changed');
        check(upload && upload.owner === review.owner && actors.has(review.owner) && ['reviewed', 'completed', 'undone', 'discarded'].includes(review.state) && (review.state === 'discarded' || upload.state === 'ready' || review.state === 'undone' || upload.state==='discarded' && review.kit_job && (await read('ik_d1_erased_sources')).some(s=>s.destination===review.owner)), 'invalid_slack_review_custody');
    }
    check(inventory.length === keys.size && new Set(inventory.map(r => r.object_key)).size === keys.size && inventory.every(r => keys.has(r.object_key)), 'object_inventory_graph_mismatch');
    if (manifest) {
        check(manifest.objects.length === keys.size, 'archive_object_reference_count');
        const seen = new Set();
        for (const object of manifest.objects) {
            const expected = keys.get(object.key);
            check(object.bucket === 'FILES' && expected && !seen.has(object.key) && object.size === expected.size && object.sha256 === expected.sha256 && object.customMetadata?.sha256 === expected.sha256 && object.httpMetadata?.contentType === expected.mime, 'archive_object_metadata_mismatch'); seen.add(object.key);
        }
    }
    return reviews;
}
