import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {realisticSlackEntries} from '../slack-import/realistic-fixture.mjs';
import {pilotPhase} from './progress.mjs';

async function read(context,origin,path){const response=await context.request.get(origin+path);assert.equal(response.status(),200,path);return response.json();}
export async function historyCensus(context,origin,conversation){
 const roots=[],messages=new Map();let before='';
 for(;;){
  const page=await read(context,origin,`/api/conversations/${conversation}/messages/window?limit=100&before=${encodeURIComponent(before)}`);
  assert.deepEqual({frontier:page.frontier,readSeq:page.readSeq,readThrough:page.readThrough},{frontier:0,readSeq:0,readThrough:0},'imported roots do not move native replay or read frontiers');
  for(const message of page.items){assert.equal(message.parent,null,'normal windows contain roots');assert.equal(messages.has(message.id),false,'root pagination never repeats a row');roots.push(message);messages.set(message.id,message);}
  if(!page.hasMore)break;assert.notEqual(page.cursor,before);before=page.cursor;
 }
 // Threads use the same public history-window door as the actual React client.
 const threaded=roots.filter(root=>root.replyCount>0);
 for(let offset=0;offset<threaded.length;offset+=2)await Promise.all(threaded.slice(offset,offset+2).map(async root=>{
  let before='',count=0;
  for(;;){const page=await read(context,origin,`/api/conversations/${conversation}/messages/window?limit=100&thread=${encodeURIComponent(root.id)}&before=${encodeURIComponent(before)}`);
   assert.deepEqual({frontier:page.frontier,readSeq:page.readSeq,readThrough:page.readThrough},{frontier:0,readSeq:0,readThrough:0},'imported threads do not move native replay or read frontiers');
   assert.equal(page.root.id,root.id);for(const message of page.items){assert.equal(message.parent,root.id);assert.equal(messages.has(message.id),false,'thread pagination never repeats a row');messages.set(message.id,message);count++;}
   if(!page.hasMore)break;assert.notEqual(page.cursor,before);before=page.cursor;
  }
  assert.equal(count,root.replyCount,'every advertised thread reply is reachable');
 }));
 return [...messages.values()];
}

export async function verifyCorpus({context,origin,channels,fixture,stamp,selected=fixture.channels,width,phase='history'}){
 const entries=realisticSlackEntries(),contentKinds=new Set(['thread_broadcast','bot_message','file_share','reminder_add']);
 const byChannel=new Map(),totals={messages:0,threads:0,files:0,missingFiles:0};
 pilotPhase(`${phase}-census-start`,{width,channels:selected.length});
 for(const source of selected){
  const destination=channels.find(c=>c.name===`${source.name} ${stamp}`);assert.ok(destination,`${source.name}: selected destination exists, including empty channels`);
  const expected=entries.filter(([path])=>path.startsWith(source.name+'/')).flatMap(([,rows])=>rows).filter(row=>row.type==='message'&&(!row.subtype||contentKinds.has(row.subtype)));
  const history=await historyCensus(context,origin,destination.id),byTimestamp=new Map(history.map(row=>[row.provenance?.timestamp,row]));
  assert.equal(history.length,expected.length,`${source.name}: every content record and no skipped system record`);
  assert.equal(byTimestamp.size,expected.length,'source timestamps remain distinct within a channel');
  for(const original of expected){
   const actual=byTimestamp.get(original.ts);assert.ok(actual,`${source.name}: ${original.ts} is reachable`);assert.equal(actual.body,original.text);assert.equal(actual.immutable,true);assert.equal(actual.author,null);assert.equal(actual.provenance.association,null);assert.ok(actual.sequence<0,'every historical position remains separate from native event positions');
   assert.equal(actual.parent,original.thread_ts&&original.thread_ts!==original.ts?byTimestamp.get(original.thread_ts)?.id:null,'thread ancestry survives');
   const files=original.files??[],supplied=files.filter(file=>fixture.suppliedFiles.some(entry=>entry.path.endsWith(`/${file.id}/${file.name}`)));
   assert.equal(actual.attachments.length,supplied.length,'every supplied source file is bound');
   for(const file of supplied){const attachment=actual.attachments.find(value=>value.sourceId===file.id);assert.ok(attachment);const supplied=fixture.suppliedFiles.find(entry=>entry.path.endsWith(`/${file.id}/${file.name}`));assert.equal(attachment.sha256,createHash('sha256').update(supplied.bytes).digest('hex'));}
   // Slack's markup and escapes read as plain text; the record keeps the source text above.
   if(/&(?:amp|lt|gt);|<[#@!h]/.test(original.text)){assert.doesNotMatch(actual.slack.text,/&(?:amp|lt|gt);|<[#@!]|<https?:/,'Slack markup is shown as plain text');if(original.text.includes('&amp;'))assert.match(actual.slack.text,/#engineering, release notes and .*\nLiteral & <script> text\./);}
   assert.equal(actual.slack.missingFiles.length,files.length-supplied.length);totals.messages++;totals.threads+=actual.parent?1:0;totals.files+=supplied.length;totals.missingFiles+=files.length-supplied.length;
  }
  assert.deepEqual(await read(context,origin,`/api/conversations/${destination.id}/outcomes`),[],'history creates no accepted work');
  const replay=await read(context,origin,`/api/conversations/${destination.id}/replay`);assert.deepEqual({events:replay.events,frontier:replay.frontier,cursor:replay.cursor,hasMore:replay.hasMore},{events:[],frontier:0,cursor:0,hasMore:false},'history creates no native replay events');
  byChannel.set(destination.id,history);
  pilotPhase(`${phase}-census-channel-complete`,{width,channels:byChannel.size,...totals});
 }
 // Search finds the plain characters the reader sees.
 if(selected.length===fixture.channels.length){const found=await read(context,origin,'/api/search?q='+encodeURIComponent('Literal & <script> text'));assert.ok(found.items.some(item=>item.displayBody?.includes('Literal & <script> text.')),'search matches the plain reading of escaped Slack text');}
 pilotPhase(`${phase}-census-complete`,{width,channels:byChannel.size,...totals});
 return {byChannel,totals};
}
