import {FORMAT,FORMAT_VERSION,type ExportBundle,type ExportRecord} from './types'

const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const anchor=(id:string)=>'message-'+encodeURIComponent(id)
export function jsonDocument(bundle:ExportBundle){return JSON.stringify(bundle,null,2)+'\n'}
export function jsonLines(bundle:ExportBundle){
 return [JSON.stringify({type:'manifest',format:FORMAT,version:FORMAT_VERSION,report:bundle.report}),
  ...bundle.records.map(record=>JSON.stringify(record)),...bundle.files.map(file=>JSON.stringify({type:'file_bytes',data:file}))].join('\n')+'\n'
}
function index(records:ExportRecord[],key:string){
 const result=new Map<string,ExportRecord[]>()
 for(const record of records){const id=record.data[key];if(typeof id==='string'){const items=result.get(id)??[];items.push(record);result.set(id,items)}}
 return result
}
const pretty=(value:unknown)=>'<pre>'+escape(JSON.stringify(value,null,2))+'</pre>'
/** Fully static, self-contained reading copy. No remote resources, executable
 * script, active source links or Markdown HTML are used. The complete format is
 * also embedded as inert JSON for a downstream importer. */
export function offlineHtml(bundle:ExportBundle){
 const byConversation=index(bundle.records,'conversation'),bytes=new Map(bundle.files.map(file=>[file.id,file]))
 const conversations=bundle.records.filter(r=>r.type==='conversations')
 const body=conversations.map(conversation=>{
  const c=conversation.data,records=byConversation.get(conversation.conversation)??[],messages=records.filter(r=>r.type==='messages'||r.type==='imported_messages')
  const versions=index(records.filter(r=>r.type==='message_versions'),'message'),reactions=index(records.filter(r=>r.type==='reactions'),'message'),files=index(records.filter(r=>r.type==='files'),'message')
  const byId=new Map(messages.map(m=>[m.data.id,m])),groups=new Map<string,ExportRecord[]>()
  const time=(m:ExportRecord)=>m.type==='imported_messages'?Number(m.data.source_timestamp)*1000:Date.parse(m.data.created)
  messages.sort((a,b)=>(time(a)-time(b))||String(a.data.id).localeCompare(String(b.data.id)))
  for(const message of messages){
   let root=message.data.id,parent=message.data.parent;const seen=new Set<string>([root])
   while(parent&&byId.has(parent)&&!seen.has(parent)){seen.add(parent);root=parent;parent=byId.get(parent)!.data.parent}
   const thread=groups.get(root)??[];thread.push(message);groups.set(root,thread)
  }
  const timeline=[...groups].map(([root,thread])=>'<section class="thread" aria-label="Conversation thread">'+thread.map(message=>{
   const m=message.data,created=message.type==='imported_messages'?new Date(Number(m.source_timestamp)*1000).toISOString():m.created
   const history=versions.get(m.id)??[],nativeReactions=reactions.get(m.id)??[],attached=files.get(m.id)??[]
   return `<article id="${escape(anchor(m.id))}" class="${m.id===root?'root':'reply'}"><header><strong>${escape(m.authorName??m.author??'Erased author')}</strong> <time>${escape(created)}</time> · ${message.type==='imported_messages'?'Imported history':'Posted in Nook'} · version ${escape(m.version??1)}</header>${m.parent?`<p class="context">Reply to <a href="#${escape(anchor(m.parent))}">${escape(m.parent)}</a></p>`:''}<pre class="message">${escape(m.deleted?'[Deleted message]':m.body)}</pre>${m.erased?'<p class="context">'+(m.retained_body?'Current body retained under erasure policy; author and prior versions erased.':'Content erased; structural thread position retained.')+'</p>':''}${nativeReactions.length?'<p>Reactions: '+nativeReactions.map(r=>escape(r.data.emoji)+' '+escape(r.data.actorName??r.data.user)).join(' · ')+'</p>':''}${m.reactions?.length?'<details><summary>Imported reactions</summary>'+pretty(m.reactions)+'</details>':''}${attached.map(record=>{
    const f=record.data,file=bytes.get(f.id)
    return file?`<p><a download="${escape(f.name)}" href="data:application/octet-stream;base64,${file.base64}">${escape(f.name)}</a> · ${escape(file.size)} bytes · SHA-256 <code>${escape(file.sha256)}</code></p>`:'<p>File omitted: '+escape(f.omission??f.id)+'</p>'
   }).join('')}${history.length?'<details><summary>Message version history</summary>'+history.sort((a,b)=>a.data.version-b.data.version).map(r=>'<p>Version '+escape(r.data.version)+' · '+escape(r.data.at)+'</p><pre>'+escape(r.data.body)+'</pre>').join('')+'</details>':''}${m.omissions?.length?'<details open><summary>Source omissions</summary>'+pretty(m.omissions)+'</details>':''}${message.type==='imported_messages'?'<details><summary>Source mapping and received source record</summary>'+pretty(m)+'</details>':''}</article>`
  }).join('')+'</section>').join('')
  const outcomes=records.filter(r=>r.type==='outcomes'),outcomeVersions=index(records.filter(r=>r.type==='outcome_versions'),'outcome')
  const work=outcomes.map(({data:o})=>`<article><h3>${escape(o.kind)} · ${escape(o.status)}</h3><pre>${escape(o.body||'[Erased outcome text]')}</pre><p>Author: ${escape(o.authorName??o.author??'Erased member')} · Assignee: ${escape(o.assigneeName??o.assignee??(o.assigneeErased?'Erased member':'—'))} · Version ${escape(o.version)} · Due ${escape(o.deadline??'—')}</p><details open><summary>Acceptance and version history</summary>${(outcomeVersions.get(o.id)??[]).sort((a,b)=>a.data.version-b.data.version).map(({data:v})=>`<p>Version ${escape(v.version)} · ${escape(v.status)} · ${escape(v.actorName??v.actor??'Erased actor')}</p><pre>${escape(v.body)}</pre>`).join('')}</details>${o.source?`<p>Source: <a href="#${escape(anchor(o.source))}">${escape(o.source)}</a>, version ${escape(o.source_version)}</p>`:''}</article>`).join('')
  const memberships=records.filter(r=>['members','dm_roster','membership_history'].includes(r.type))
  const metadata=records.filter(r=>!['conversations','messages','imported_messages','message_versions','outcomes','outcome_versions','members','dm_roster','membership_history'].includes(r.type))
  return `<section id="conversation-${escape(encodeURIComponent(c.id))}"><h2>${escape(c.name)} <small>${escape(c.kind)}</small></h2>${c.topic?'<p>'+escape(c.topic)+'</p>':''}<details><summary>Conversation and membership history</summary>${pretty(c)}${memberships.map(r=>'<h3>'+escape(r.type)+'</h3>'+pretty(r.data)).join('')}</details><h3>Messages and threads</h3>${timeline||'<p>No messages in this scope.</p>'}<h3>Decisions and commitments</h3>${work||'<p>No outcomes.</p>'}<details><summary>Source mappings, file index, reactions and configuration</summary>${metadata.map(r=>'<h3>'+escape(r.type)+'</h3>'+pretty(r.data)).join('')}</details></section>`
 }).join('')
 const embedded=JSON.stringify(bundle).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src data:; base-uri 'none'; form-action 'none'"><title>Nook readable export</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#202522;background:#f8f7f2;max-width:960px;margin:auto;padding:24px;overflow-wrap:anywhere}h1,h2,h3{line-height:1.25}h2{margin-top:3rem;border-top:2px solid #bbb;padding-top:1.5rem}small,time,.context{font-size:.85em;color:#535c55}article,details{background:#fff;border:1px solid #d7dcd6;border-radius:8px;padding:16px;margin:12px 0}.reply{margin-left:24px;border-left:4px solid #8ea38c}.thread{margin:24px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.message{margin:10px 0}code{font-size:.8em}a{color:#235c49}summary{cursor:pointer}li{margin:8px 0}@media(max-width:500px){body{padding:12px}.reply{margin-left:12px}article{padding:12px}}</style></head><body><h1>Nook readable export</h1><p>${escape(bundle.report.created)} · format ${FORMAT_VERSION} · ${escape(bundle.report.records)} records · ${escape(bundle.report.files)} files · ${escape(bundle.report.bytes)} file bytes</p><p>${escape(bundle.report.custody)}</p><details open><summary>Completeness and omissions</summary>${pretty(bundle.report)}<ul>${bundle.report.omissions.map(o=>'<li><strong>'+escape(o.code)+':</strong> '+escape(o.reason)+'</li>').join('')}</ul></details><nav aria-label="Exported conversations"><ul>${conversations.map(({data:c})=>`<li><a href="#conversation-${escape(encodeURIComponent(c.id))}">${escape(c.name)}</a></li>`).join('')}</ul></nav>${body}<script type="application/json" id="nook-export">${embedded}</script></body></html>`
}
