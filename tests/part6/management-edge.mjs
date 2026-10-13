import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {platformSource} from './ts-source.mjs';
import {embeddingAuthority} from './management-authority.mjs';

/** The only substituted system is the network management edge. Source compilation
 * is the actual reviewed platform compiler; Nook auth/Worker/widget are unchanged. */
export async function managementEdge(root,platformRoot) {
 const source=platformSource(platformRoot);
 const {compileVisualSource}=await source.load('src/live-edits/source-snapshot.ts');
 const {updateVisualSourceLock}=await source.load('src/live-edits/source-lock.ts');
 const {validLiveEditSnapshot}=await source.load('widget/live-edit-contracts.ts');
 const session=randomUUID(),login=randomUUID();
 const state={allowed:'',authorize:async()=>false,claimToken:async()=>null,requests:0,saved:0,deny:false};
 const embedding=await embeddingAuthority(source,state);
 let origin;
 const server=createServer(async(request,response)=>{
  try {
   const url=new URL(request.url,origin);
   response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
   if(url.pathname==='/signin'&&request.method==='POST') {
    let body='';for await(const chunk of request){body+=chunk;if(body.length>1000)throw Error('body')}
    if(body!==login){response.writeHead(403).end();return}
    response.setHeader('Set-Cookie',`fixture_management=${session}; Path=/; HttpOnly; SameSite=Lax`);response.writeHead(204).end();return;
   }
   if(url.pathname==='/unauthorized') {
    response.setHeader('Content-Type','text/html');response.end(`<iframe src="/editor?installation=nook-local&parentOrigin=${encodeURIComponent(origin)}"></iframe>`);return;
   }
   if(!request.headers.cookie?.split(';').some(value=>value.trim()===`fixture_management=${session}`)) {response.writeHead(403).end('Management authorization required');return}
   if(url.pathname==='/claim'&&request.method==='POST') {
    if(request.headers.origin!==origin){response.writeHead(403).end();return}
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify({token:await state.claimToken()}));return;
   }
   if(url.pathname==='/installation') {
    response.setHeader('Content-Type','text/html');response.end(`<!doctype html><button>Claim installation</button><script>
const origin=${JSON.stringify(state.allowed)};let popup,token;
addEventListener('message',event=>{if(event.origin===origin&&event.source===popup&&event.data?.type==='rer-owner-claim-ready')popup.postMessage({type:'rer-owner-claim',token},origin)});
document.querySelector('button').onclick=async()=>{token=(await(await fetch('/claim',{method:'POST'})).json()).token;popup=open(origin+'/auth/owner-claim','owner-claim')};
</script>`);return;
   }
   if(!await state.authorize()) {response.writeHead(403).end('Native owner authorization required');return}
   if(url.pathname==='/edits'&&request.method==='POST') {
    if(request.headers.origin!==origin){response.writeHead(403).end();return}
    let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>65536)throw Error('body')}
    const snapshot=JSON.parse(raw);
    if(!validLiveEditSnapshot(snapshot)||snapshot.edits.some(edit=>edit.parentOrigin!==state.allowed||edit.path!=='/')){response.writeHead(400).end();return}
    const visual=resolve(root,'src/editor/visual-edits.json'),lockPath=resolve(root,'sources.lock.json');
    const previous=await readFile(visual,'utf8'),next=compileVisualSource(previous,{...snapshot,records:snapshot.edits.map(edit=>({id:edit.id}))});
    const lock=await updateVisualSourceLock(await readFile(lockPath,'utf8'),previous,next);
    // Recheck actual Nook session before source writes, including revocation while compiling.
    if(!await state.authorize()){response.writeHead(403).end();return}
    await writeFile(visual,next);await writeFile(lockPath,lock);state.saved++;
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify({saved:true}));return;
   }
   if(url.pathname!=='/editor'){response.writeHead(404).end();return}
   state.requests++;
   response.setHeader('Content-Type','text/html');
   const secured=await embedding.response(new Request(url),new Response('editor',{headers:{'Content-Type':'text/html','Content-Security-Policy':"object-src 'none'; base-uri 'none'"}}));
   for(const [name,value] of secured.headers)response.setHeader(name,value);
   // Frame permission comes from independently registered state.allowed, never query input.
   response.end(`<!doctype html><html><body><section style="width:min(340px,calc(100vw - 16px));padding:12px;box-sizing:border-box;background:white;border:1px solid #888;font:16px system-ui"><strong>Local management edge</strong><input aria-label="Draft"/><button id="save">Save local edit</button><p id="status">Connected</p></section><script>
const parentOrigin=${JSON.stringify(state.allowed)},installationId='nook-local';let sessionId,context;window.received=[];
const send=(type,values={})=>parent.postMessage({...values,protocol:'rer-editor',version:1,installationId,type,...(sessionId?{sessionId}:{})},parentOrigin);window.send=send;
const regions=()=>send('interactive-regions',{viewport:{width:innerWidth,height:innerHeight},regions:[{x:8,y:8,width:Math.min(340,innerWidth-16),height:160}]});
addEventListener('message',event=>{if(event.origin!==parentOrigin||event.source!==parent)return;const m=event.data;if(m.protocol!=='rer-editor'||m.version!==1||m.installationId!==installationId)return;if(m.type==='protocol-offer'){sessionId=m.sessionId;send('protocol-accept');return}if(m.sessionId!==sessionId)return;window.received.push(m);if(m.type==='protocol-connected'||m.type==='editor-visibility')regions();if(m.type==='page-context')context=m.context;});
document.querySelector('#save').onclick=async()=>{send('set-context-sharing',{enabled:true});send('capture-context',{requestId:'source-save'});for(let n=0;!context&&n<40;n++)await new Promise(r=>setTimeout(r,25));const target=context?.elements.find(e=>e.tag==='h1');if(!target)throw Error('Actual rendered heading missing');const snapshot={revision:1,edits:[{id:'local-heading',revision:1,parentOrigin,path:'/',target:{selector:target.selector,tag:target.tag,role:target.role,beforeText:target.text},change:{text:'Published local source proof'}}]};const response=await fetch('/edits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});if(!response.ok)throw Error('Source write refused');send('live-edits',{snapshot});document.querySelector('#status').textContent='Source saved';};send('ready');
</script></body></html>`);
  }catch{response.writeHead(500).end('Local management edge failed')}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));origin=`http://127.0.0.1:${server.address().port}`;
 return {state,origin,login,close:async()=>{server.closeAllConnections();await new Promise(ok=>server.close(ok));embedding.close();source.close()}};
}
