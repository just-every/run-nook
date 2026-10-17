import type {Context} from '../platform/storage/context'

// Compose with the membership deletion in its guarded transaction. Pending
// delivery is permanently cancelled. Leased sends keep their factual result;
// the worker rechecks current membership before contacting the provider.
export function channelDeparture(c:Context,conversation:string,user:string){
 const action=crypto.randomUUID()
 return [
  c.sql("UPDATE nook_notify_queue SET state='cancelled',error='membership-ended',email=NULL,token_hash=NULL,updated=? WHERE conversation=? AND user=? AND state IN ('pending','retrying')",Date.now(),conversation,user),
  c.sql(`INSERT INTO nook_channel_actions SELECT ?,c.id,c.version+1,c.seq+1,'vacate',NULL,NULL,? FROM nook_conversations c LEFT JOIN nook_channel_settings s ON s.conversation=c.id WHERE c.id=? AND c.kind<>'dm' AND CASE WHEN s.conversation IS NULL THEN c.owner ELSE s.manager END=?`,action,new Date().toISOString(),conversation,user),
  c.sql('INSERT INTO nook_channel_settings(conversation,manager) SELECT conversation,NULL FROM nook_channel_actions WHERE id=? ON CONFLICT(conversation) DO UPDATE SET manager=NULL',action),
  c.sql('UPDATE nook_conversations SET version=version+1,seq=seq+1 WHERE id=? AND EXISTS(SELECT 1 FROM nook_channel_actions WHERE id=?)',conversation,action),
  c.sql("INSERT INTO nook_events SELECT c.id,c.seq,'channel',a.id,NULL FROM nook_channel_actions a JOIN nook_conversations c ON c.id=a.conversation WHERE a.id=?",action),
 ]
}
