import type {Context} from '../platform/storage/context'
import type {fenceService,Sql} from '../team/erasure/portability'
import {sql,files} from '../team/erasure/statements'
export async function eraseScheduleFiles(c:Context,f:Awaited<ReturnType<typeof fenceService>>,operation:string,where:string,values:any[]){
 const rows=await c.rows(`SELECT file.*,schedule.version AS revision,schedule.user AS owner FROM nook_schedule_files file JOIN nook_schedules schedule ON schedule.id=file.schedule WHERE ${where} ORDER BY file.schedule,file.position LIMIT 30`,values),statements:Sql[]=[]
 for(const id of new Set<string>(rows.map(row=>row.schedule))){
  const selected=rows.filter(row=>row.schedule===id),removed=new Set(selected.map(row=>row.attachment)),all=await c.rows('SELECT * FROM nook_schedule_files WHERE schedule=? ORDER BY position',[id]),remaining=all.filter(row=>!removed.has(row.attachment)),guard=crypto.randomUUID()
  statements.push(sql('INSERT INTO nook_guard VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM nook_schedules WHERE id=? AND version=?) THEN 1 ELSE 0 END)',guard,id,selected[0].revision))
  for(const row of selected){
   const copies=await c.rows(`SELECT a.id,?||substr(a.id,16) AS object_key FROM nook_attachments a WHERE a.author=? AND a.state<>'attached' AND length(a.id)=79 AND substr(a.id,1,15)='scheduled-file:' AND a.intent='scheduled-template:'||?||':'||substr(a.id,16) AND (a.object_key IS NOT NULL OR EXISTS(SELECT 1 FROM nook_object_deletes d WHERE d.object_key=?||substr(a.id,16)) OR EXISTS(SELECT 1 FROM nook_upload_attempts p WHERE p.object_key=?||substr(a.id,16)))`,['private/scheduled/',row.owner,row.attachment,'private/scheduled/','private/scheduled/'])
   // In-flight and unconfirmed private copies remain template custody. Sent
   // copies have already become independent message files and are excluded.
   statements.push(...await files(c,f,operation,'id IN (SELECT value FROM json_each(?))',[JSON.stringify(copies.map(copy=>copy.id))]))
   for(const copy of copies)statements.push(sql('INSERT OR IGNORE INTO nook_erasure_blobs VALUES(?,?)',operation,copy.object_key),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',copy.object_key,Date.now()))
   statements.push(...await f.row('nook_schedule_files',{schedule:id,attachment:row.attachment}),sql('INSERT OR IGNORE INTO nook_erasure_blobs VALUES(?,?)',operation,row.object_key),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',row.object_key,Date.now()))
  }
  // Rebuild the tiny ordered list atomically so erasing its first entry cannot
  // leave gaps or collide with a later entry's unique position.
  statements.push(sql('DELETE FROM nook_schedule_files WHERE schedule=?',id))
  remaining.forEach((row,position)=>statements.push(sql('INSERT INTO nook_schedule_files VALUES(?,?,?,?,?,?,?,?)',id,row.attachment,position,row.name,row.mime,row.size,row.sha256,row.object_key)))
  statements.push(sql("UPDATE nook_schedules SET state='failed',version=version+1,reason='A scheduled file was erased; review future messages',payload=json_set(payload,'$.attachments',json(?)) WHERE id=?",JSON.stringify(remaining.map(row=>row.attachment)),id),sql('DELETE FROM nook_guard WHERE id=?',guard))
 }
 return {statements,count:rows.length}
}
