import assert from 'node:assert/strict';
// Measurement client: authoritative catch-up checks, never a transport simulator.
export async function observer({call,owner,channels}){
 const cursors=new Map(),events=[],projections=new Map();let pages=0;
 for(const channel of channels){const window=await call('baseline-window','/api/conversations/'+channel.id+'/messages/window?limit=1',owner);cursors.set(channel.id,window.frontier)}
 const baselines=Object.fromEntries(cursors);
 async function drain(){
  for(const channel of channels){let more;do{
   const after=cursors.get(channel.id),page=await call('authoritative-replay','/api/conversations/'+channel.id+'/replay?after='+after,owner);pages++;let expected=after+1;
   for(const event of page.events){assert.equal(event.conversation,channel.id);assert.equal(event.seq,expected++,'authoritative replay has no gaps or duplicates');assert.deepEqual(Object.keys(event).sort(),['conversation','kind','object','seq']);events.push(event);if(['message','edit','delete'].includes(event.kind)){const current=await call('replay-projection','/api/messages/'+event.object,owner);assert.equal(current.id,event.object);assert.equal(current.conversation,channel.id);if(current.deleted){assert.equal(current.body,'');assert.ok(current.attachments.every(a=>a.state==='deleted'))}projections.set(current.id,current)}}
   assert.equal(page.cursor,expected-1);assert.ok(page.cursor<=page.frontier);assert.equal(page.hasMore,page.cursor<page.frontier);cursors.set(channel.id,page.cursor);more=page.hasMore;
  }while(more)}
 }
 return {drain,events,projections,baselines,cursors,get pages(){return pages},verify(db){
  for(const channel of channels){const rows=db.prepare('SELECT conversation,seq,kind,object FROM nook_events WHERE conversation=? AND seq>? ORDER BY seq').all(channel.id,baselines[channel.id]);assert.deepEqual(events.filter(e=>e.conversation===channel.id),rows.map(r=>({...r})),'replay independently equals every committed event');assert.equal(cursors.get(channel.id),db.prepare('SELECT seq FROM nook_conversations WHERE id=?').get(channel.id).seq)}
  for(const [id,seen] of projections){const stored=db.prepare('SELECT id,conversation,body,parent,version,deleted,sequence FROM nook_messages WHERE id=?').get(id);for(const [key,value] of Object.entries(stored))assert.equal(seen[key],value,'replayed current projection: '+key)}
  return {baselines,frontiers:Object.fromEntries(cursors),pages,events:events.length,projections:projections.size,missingEvents:0,duplicateEvents:0,gaps:0};
 }}
}
