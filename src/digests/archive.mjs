import {validateScheduleTime,occurrenceAt} from '../scheduled/time.mjs';
export async function validateDigests(read,manifest,actors,conversations,messages,files){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_digest_schedules'))return;
 const schedules=await read('nook_digest_schedules');
 for(const row of schedules){
  if(!actors.has(row.user)||actors.get(row.user).erased||row.enabled!==0||!['daily','weekly'].includes(row.cadence)||!['app','email'].includes(row.delivery)||![row.version,row.operator_version,row.access_generation].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(row.updated))throw Error('invalid_digest_schedule');
  const time=validateScheduleTime({localAt:row.local_at,zone:row.zone,recurrence:row.cadence,endDate:null});if(!Number.isSafeInteger(row.next_due)||occurrenceAt(time.localAt,time.zone)>row.next_due)throw Error('invalid_digest_due');
 }
 const imported=new Map((await read('nook_import_records')).map(row=>[row.id,row]));
 for(const row of await read('nook_digest_deliveries')){
  if(!actors.has(row.user)||actors.get(row.user).erased||!['deferred','delivering','delivered','empty','failed','skipped'].includes(row.state)||!Number.isSafeInteger(row.version)||row.version<1||![row.due,row.created,row.updated].every(Number.isSafeInteger)||(row.reason!==null&&typeof row.reason!=='string'))throw Error('invalid_digest_delivery');
  if(!row.receipt){if(row.state==='delivered')throw Error('missing_digest_receipt');continue}
  const receipt=JSON.parse(row.receipt);if(row.state!=='delivered'||receipt.delivery!==row.id||!Array.isArray(receipt.points)||receipt.points.length>16||!Array.isArray(receipt.range?.collection)||receipt.range.collection.length>100||!Number.isSafeInteger(receipt.created)||!Number.isSafeInteger(receipt.version))throw Error('invalid_digest_receipt');
  for(const range of receipt.range.collection)if(!conversations.has(range.conversation)||!Number.isSafeInteger(range.unreadAfter)||typeof range.from!=='string'||typeof range.through!=='string')throw Error('invalid_digest_range');
  for(const point of receipt.points){const source=point.id?.startsWith('message:')?messages.get(point.id.slice(8))??imported.get(point.id.slice(8)):point.id?.startsWith('file:')?files.get(point.id.slice(5)):null;if(!source||source.erased||source.deleted||source.state==='deleted'||!/^[a-f0-9]{64}$/.test(point.hash)||!Number.isSafeInteger(point.start)||point.start<0||!Number.isSafeInteger(point.length)||point.length<1||typeof point.question!=='boolean')throw Error('invalid_digest_point')}
 }
}
export const portableDigestSchedule=row=>({...row,enabled:0});
export const portableDigestDelivery=row=>row.state==='delivering'?{...row,state:'failed',reason:'Restored interrupted digest: no send is resumed',receipt:null}:row;
