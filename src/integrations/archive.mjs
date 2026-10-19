// NOOK-079 portability: token secrets (sealed hashes) and their bindings are
// credentials and never travel; a restored installation's owner issues new tokens.
// The use history travels so posts keep their "via" label and audit trail.
export const integrationExcludedTables=['nook_integration_tokens','nook_integration_bindings'];
const check=(ok)=>{if(!ok)throw Error('invalid_integration_audit')};
const actions=['create','rotate','revoke','post','replay','refuse'];
export async function validateIntegrationArchive(read,manifest,actors,conversations,messages){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_integration_audit'))return;
 const ids=new Set();
 for(const row of await read('nook_integration_audit')){
  check(typeof row.id==='string'&&!ids.has(row.id)&&typeof row.family==='string'&&typeof row.token==='string'&&typeof row.name==='string'&&row.name.length>0&&row.name.length<=80&&Number.isSafeInteger(row.at)&&actions.includes(row.action));
  check((row.actor===null||actors.has(row.actor))&&(row.conversation===null||typeof row.conversation==='string')&&(row.code===null||typeof row.code==='string')&&(row.route===null||typeof row.route==='string'));
  check(row.message===null||typeof row.message==='string'&&(!['post','replay'].includes(row.action)||messages.has(row.message)||conversations.has(row.conversation)));
  ids.add(row.id);
 }
}
