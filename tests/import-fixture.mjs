import {validateImportCapture,importDigest} from '../src/family/team-chat/import-capture.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
export function source(root,owner,member){const dir=join(root,'source');mkdirSync(dir);mkdirSync(join(dir,'general'));writeFileSync(join(dir,'users.json'),JSON.stringify([{id:'U1',name:'Historic person'},{id:'U2',name:'Historic person',deleted:true}]));writeFileSync(join(dir,'channels.json'),JSON.stringify([{id:'C1',name:'general'}]));writeFileSync(join(dir,'general','2026-10-03.json'),JSON.stringify([{type:'message',user:'U1',text:'  faithful <script> untrusted source text\n',ts:'1700000000.000001',edited:{user:'U1',ts:'1700000000.000002'},files:[{id:'F1',name:'proof.txt',mimetype:'text/plain',size:5,url_private:'https://never-fetch.invalid/source-token'}]},{type:'message',user:'U2',text:'reply',ts:'1700000001.000001',thread_ts:'1700000000.000001'}]));writeFileSync(join(dir,'bytes.txt'),'proof');return {dir,mapping:{sourceNamespace:'synthetic-faithful',actors:{U1:owner,U2:null},channels:{C1:{destination:'imported-general',audience:[owner,member]}}},supplied:{F1:{path:'bytes.txt'}}}}

// The same synthetic history in an ordinary ZIP, prepared by the maintained
// Slack reader and imported through the shared operator door.
export async function sourceDoor({origin,owner,member,sql,namespace='synthetic-'+crypto.randomUUID(),sourceAuthor=owner.user.id}){
 const {zipFixture}=await import('./slack-import/fixture.mjs');
 const {importDoorClient,importUsers}=await import('./import-door-support.mjs');
 const bytes=zipFixture([['users.json',[{id:'U1',name:'Historic person'},{id:'U2',name:'Historic person',deleted:true}]],['channels.json',[{id:'C1',name:'general'}]],['general/2026-10-03.json',[{type:'message',user:'U1',text:'  faithful <script> untrusted source text\n',ts:'1700000000.000001',edited:{user:'U1',ts:'1700000000.000002'},files:[{id:'F1',name:'proof.txt',mimetype:'text/plain',size:5}]},{type:'message',user:'U2',text:'reply',ts:'1700000001.000001',thread_ts:'1700000000.000001'}]],['files/F1/proof.txt','proof']]);
 const door=importDoorClient({origin,owner,users:()=>importUsers(sql)}),inspection=await door.inspect(bytes),review={namespace,actors:{U1:sourceAuthor,U2:null},channels:[{sourceId:'C1',name:'Imported general '+namespace,members:[owner.user.id,member.user.id]}],acceptedOmissions:[]};
 const prepared=await door.prepare(inspection,review);
 if(prepared.summary.needsOmissionReview)review.acceptedOmissions=[prepared.summary.omissionDigest];
 return {door,inspection,review,capture:prepared.packet.capture,plan:await door.plan(inspection,review)};
}

// Independently authored legacy rows for the offline recovery door. This is
// historical fixture data, not another application import implementation.
export function historicalImportFixture(state,owner,capture,intent){
 const {captureDigest}=validateImportCapture(capture),job={id:'historical-job-'+intent,owner:owner.id,intent,planDigest:importDigest({policy:'immutable-new-private-v1',owner:owner.id,captureDigest}),captureDigest,created:'2026-10-03T00:00:00.000Z',capture,channels:capture.channels.map((c,i)=>({sourceId:c.sourceId,id:'historical-channel-'+intent+'-'+i})),records:capture.records.map((r,i)=>({key:r.key,id:'historical-record-'+intent+'-'+i})),files:capture.files.map((f,i)=>({message:f.message,sourceId:f.sourceId,id:'historical-file-'+intent+'-'+i}))};
 state.imports.push(job);
 for(const c of job.channels){const source=capture.channels.find(s=>s.sourceId===c.sourceId);state.conversations.push({id:c.id,name:source.destinationName,kind:'private',owner:owner.id,members:source.audience,seq:0})}
 return job;
}
