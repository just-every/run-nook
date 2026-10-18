import {mattermostNativeId} from './mattermost-effects.mjs';
/** Archive graph edges supplement the immutable reviewed-plan validation. */
export function validateMattermostArchiveMessage(row,source,destination,job,imported,domains){
 const expectedParent=source.sourceParent?mattermostNativeId(job.namespace,'message',`${job.namespace}:${destination.source_id}:${source.sourceParent}`):null;
 if(!domains.has(row.job)||row.key!==`${job.namespace}:${destination.source_id}:${source.id}`||source.room_id!==destination.source_id||source.creator_id!==row.source_actor||source.sourceTimestamp!==row.source_timestamp||source.bodyText!==row.body||row.parent!==expectedParent)throw Error('invalid_mattermost_provenance');
 if(row.parent){const parent=imported.get(row.parent);if(!parent||parent.conversation!==row.conversation||parent.parent!==null)throw Error('invalid_mattermost_thread');}
}
