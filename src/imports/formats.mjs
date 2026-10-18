import {sourceFileRefs} from './slack-records.mjs';
import {inspectSlackArchive,captureSlackArchive} from './slack.mjs';
import {inspectCampfireBackup} from './campfire.mjs';
import {publicCampfireInspection,captureCampfireBackup,campfireSummary,campfireFileHashes} from './campfire-capture.mjs';
import {CAMPFIRE_MAPPING_VERSION,assertCampfireEffect} from './campfire-effects.mjs';
import {MAPPING_VERSION} from './ids.mjs';
import {assertSlackEffect} from './policy.mjs';
export const sourceKind=upload=>upload.object_key.endsWith('/archive.campfire.tar.gz')?'campfire':'slack';
export const mappingVersion=review=>JSON.parse(review.summary_json).sourceType==='campfire'?CAMPFIRE_MAPPING_VERSION:MAPPING_VERSION;
export const inspectSource=(bytes,kind,users)=>kind==='campfire'?inspectCampfireBackup(bytes):inspectSlackArchive(bytes,users);
export const captureSource=(inspected,review,owner,users)=>inspected.source?.implementation==='once-campfire-express'?captureCampfireBackup(inspected,review,owner,users):captureSlackArchive(inspected,review,owner,users);
export const publicCampfire=publicCampfireInspection;
export const summaryCampfire=campfireSummary;
export function assertImportEffect(kind,value){return value?.job?.startsWith('campfire-')?assertCampfireEffect(kind,value):assertSlackEffect(kind,value)}

export const sourceMessageFiles=record=>record?.nookSource==='campfire'?record.sourceFiles.map(f=>({id:f.sourceId,name:f.name,mimetype:f.mime,size:f.size,sha256:f.sha256})):sourceFileRefs(record);

export {campfireFileHashes};
