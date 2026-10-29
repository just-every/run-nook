export const notificationExcludedTables=['nook_notification_capabilities','nook_notification_requests','nook_notification_secrets','nook_notification_rates','nook_notification_email_facts'];
export async function validateNotificationApps(read,manifest,actors,conversations){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_notification_apps'))return;
 const rows=await read('nook_notification_apps'),ids=new Set();
 for(const row of rows){
  const actor=actors.get(row.id);
  if(ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>80||actor?.role!=='app'||actor.name!==row.name||actor.email!==null||actor.active!==0||!['channel','private'].includes(conversations.get(row.conversation)?.kind)||row.creator!==null&&!actors.has(row.creator)||!Number.isSafeInteger(row.created)||!['active','revoked','removed','reissue'].includes(row.state))throw Error('invalid_notification_approval');
  ids.add(row.id);
 }
 for(const actor of actors.values())if(actor.role==='app'&&!ids.has(actor.id))throw Error('app_without_approval');
 for(const row of await read('nook_notification_sharing'))if(!conversations.has(row.conversation)||!['local','shared','unknown'].includes(row.state))throw Error('invalid_notification_sharing');
}
