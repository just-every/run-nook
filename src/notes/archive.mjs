const check=(value,code)=>{if(!value)throw Error(code)};
const id=value=>typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const number=value=>Number.isSafeInteger(value)&&value>0;
const fields=(row,names)=>Object.keys(row).sort().join()===names.slice().sort().join();
function contents(row){
 let items,links;try{items=JSON.parse(row.items_json);links=JSON.parse(row.links_json)}catch{check(false,'invalid_note_json')}
 check(typeof row.title==='string'&&row.title.length<=200&&typeof row.body==='string'&&row.body.length<=8000,'invalid_note_text');
 check(Array.isArray(items)&&items.length<=50&&Array.isArray(links)&&links.length<=10,'invalid_note_lists');
 for(const item of items)check(fields(item,['id','text','checked'])&&id(item.id)&&typeof item.text==='string'&&item.text.trim()===item.text&&item.text.length>0&&item.text.length<=500&&typeof item.checked==='boolean','invalid_note_item');
 check(new Set(items.map(item=>item.id)).size===items.length,'duplicate_note_item');
 for(const link of links){
  let url;try{url=new URL(link.url)}catch{check(false,'invalid_note_link')}
  check(fields(link,['url','label'])&&typeof link.url==='string'&&link.url.length<=2048&&!/[\u0000-\u0020\u007f]/.test(link.url)&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!!url.hostname&&url.href===link.url&&typeof link.label==='string'&&link.label.trim()===link.label&&link.label.length>0&&link.label.length<=200,'invalid_note_link');
 }
 check([0,1].includes(row.pinned)&&[0,1].includes(row.deleted),'invalid_note_state');
 check(row.pinned?time(row.pinned_at):row.pinned_by===null&&row.pinned_at===null,'invalid_note_pin');
 check(row.deleted?row.title===''&&row.body===''&&items.length===0&&links.length===0&&row.pinned===0:row.title.trim()===row.title&&row.title.length>0,'invalid_deleted_note');
 return items;
}
/** Call after core actors/conversations/messages/imports/outcomes are indexed.
 * Older manifests may omit all three tables. Current membership is deliberately
 * not required for historical authors; live reads supply current ACL. */
export async function validateNotesArchive(read,{manifest,actors,conversations,messages,imported,outcomes}){
 const tables=['nook_notes','nook_note_versions','nook_note_proposals'];
 const present=manifest?.tables?new Set(manifest.tables.map(table=>table.name)):null;
 if(present&&!tables.some(table=>present.has(table)))return new Map();
 check(!present||tables.every(table=>present.has(table)),'incomplete_note_schema');
 const [notes,versions,proposals]=await Promise.all(tables.map(read));
 const map=new Map(),history=new Map(),items=new Map();
 const actor=value=>value===null||actors.has(value)&&!actors.get(value).erased;
 for(const note of notes){
  check(fields(note,['id','conversation','thread','author','created','updated','version','title','body','items_json','links_json','pinned','pinned_by','pinned_at','deleted'])&&id(note.id)&&!map.has(note.id)&&conversations.has(note.conversation)&&actor(note.author)&&actor(note.pinned_by)&&time(note.created)&&time(note.updated)&&number(note.version),'invalid_note');
  if(note.thread!==null){const root=messages.get(note.thread)??imported.get(note.thread);check(id(note.thread)&&root&&root.conversation===note.conversation&&root.parent===null,'invalid_note_thread')}
  contents(note);map.set(note.id,note);
 }
 for(const row of versions){
  check(fields(row,['note','version','actor','created','title','body','items_json','links_json','pinned','pinned_by','pinned_at','deleted','reverted_from'])&&map.has(row.note)&&number(row.version)&&actor(row.actor)&&actor(row.pinned_by)&&time(row.created)&&(row.reverted_from===null||number(row.reverted_from)&&row.reverted_from<row.version),'invalid_note_version');
  const key=JSON.stringify([row.note,row.version]);check(!items.has(key),'duplicate_note_version');items.set(key,contents(row));
  const group=history.get(row.note)??[];group.push(row);history.set(row.note,group);
 }
 for(const note of notes){
  const rows=(history.get(note.id)??[]).sort((a,b)=>a.version-b.version);
  check(rows.length===note.version&&rows.every((row,i)=>row.version===i+1),'missing_note_history');
  const last=rows.at(-1);check(['title','body','items_json','links_json','pinned','pinned_by','pinned_at','deleted'].every(key=>last[key]===note[key])&&last.created===note.updated,'note_history_mismatch');
 }
 const used=new Set(),sources=new Set();
 for(const link of proposals){
  const note=map.get(link.note),outcome=outcomes.get(link.outcome),key=JSON.stringify([link.note,link.item,link.note_version]);
  check(fields(link,['outcome','note','item','note_version','created'])&&note&&id(link.item)&&number(link.note_version)&&time(link.created)&&outcome?.kind==='commitment'&&outcome.conversation===note.conversation&&!used.has(link.outcome)&&!sources.has(key),'invalid_note_proposal');
  // Explicit deletion erases source text; the opaque binding can survive.
  const historical=history.get(link.note)?.find(row=>row.version===link.note_version);
  check(historical&&(historical.deleted||items.get(JSON.stringify([link.note,link.note_version]))?.some(item=>item.id===link.item)),'invalid_note_proposal_item');
  used.add(link.outcome);sources.add(key);
 }
 return map;
}
