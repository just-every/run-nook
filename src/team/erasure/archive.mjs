/** Real tombstone tables have their own keys. No archive row or PK is disguised. */
export function erasureArchiveRead(read){
 const cache=new Map();const get=name=>{if(!cache.has(name))cache.set(name,Promise.resolve(read(name)));return cache.get(name)};
 return async name=>{
  const rows=await get(name);
  if(name==='nook_actors')return [...rows,...(await get('nook_erased_actors')).map(a=>({id:a.id,name:'Erased member',email:null,role:null,active:0,erased:true}))];
  if(name==='nook_messages')return [...rows,...(await get('nook_erased_messages')).map(m=>({...m,body:'',body_lower:'',deleted:1,intent:'erased:'+m.id,payload:'[erased]',erased:true}))];
  if(name==='nook_attachments')return [...rows,...(await get('nook_erased_attachments')).map(a=>({...a,name:'',mime:'application/octet-stream',size:0,sha256:null,expires:0,state:'deleted',object_key:null,intent:'erased:'+a.id,erased:true}))];
  if(name==='nook_import_records')return [...rows,...(await get('nook_erased_import_messages')).map(m=>({...m,key:'erased:'+m.id,source_actor:'erased',source_record:'{}',body:'',body_lower:'',erased:true}))];
  if(name==='nook_outcome_versions')return [...rows,...(await get('nook_erased_outcome_actions')).map(v=>({...v,actor:null,erasedAction:true}))];
  if(name==='nook_outcomes'){const detached=new Set((await get('nook_erased_assignees')).map(v=>v.outcome));return [...rows.map(o=>({...o,assigneeErased:detached.has(o.id)})),...(await get('nook_erased_outcomes')).map(o=>({...o,author:null,assignee:null,body:'',source:null,source_version:null,deadline:null,erased:true}))];}
  return rows;
 }
}
