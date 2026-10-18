import {savedAccess,savedLiveMessage} from '../team/saved-policy'
/** No source body is captured. Current membership and source existence are
 * required both at delivery and on every hydrated list. */
export function reminderAvailable(r='r',user=r+'.recipient'){
 return `(${r}.conversation IS NULL OR (${savedAccess(r+'.conversation',user)} AND (${r}.source IS NULL OR ${r}.source_kind='message' AND ${savedLiveMessage(r+'.source',r+'.conversation')} OR ${r}.source_kind='attachment' AND EXISTS(SELECT 1 FROM nook_attachments f WHERE f.id=${r}.source AND f.conversation=${r}.conversation AND f.state='attached' AND f.object_key IS NOT NULL AND ${savedLiveMessage('f.message','f.conversation')}))))`
}
