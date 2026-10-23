// Test preparation uses the production local reader; all durable operations use
// the authenticated public door. Only the transport may be supplied by SQLite.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';
registerHooks({
 resolve(specifier,context,next){try{return next(specifier,context)}catch(error){if(specifier.startsWith('.')&&existsSync(new URL(specifier+'.ts',context.parentURL)))return next(specifier+'.ts',context);throw error}},
 load(url,context,next){if(url.endsWith('.ts'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}}).outputText};if(url.endsWith('.json'))return next(url,{...context,importAttributes:{type:'json'}});return next(url,context)}
});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function importUsers(sql){return (await sql("SELECT o.id,o.email,o.display_name AS name,o.version,a.mode,a.generation FROM oa_operators o JOIN nook_access a ON a.user=o.id AND a.active=1 WHERE o.status='active' ORDER BY o.id")).map(u=>({...u,active:true}))}
export function importDoorClient({origin,owner,source='slack',users,transport=fetch}){
 const base=()=>typeof origin==='function'?origin():origin;
 async function request(action,body={},options={}){
  const {actor=owner,status=200,namespace}=options,path='/api/operator/import/'+action;
  const response=await transport(base()+path,{method:action.startsWith('history')?'GET':'POST',headers:{Connection:'close',Origin:base(),Host:new URL(base()).host,cookie:actor.cookie,'X-Import-Source':source,...(namespace?{'X-Import-Namespace':namespace}:{}),'Content-Type':'application/json'},body:action.startsWith('history')?undefined:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(result)}`);return result;
 }
 async function inspect(bytes){const {inspectLocal}=await import('../src/imports/local-source.ts');return inspectLocal(new File([bytes],source==='campfire'?'source.tar.gz':'source.zip'),source,await users())}
 async function prepare(inspection,review){const {prepareLocal}=await import('../src/imports/local-source.ts');return prepareLocal(inspection.handle,review,owner.user.id,await users())}
 async function upload(packet){const bytes=Buffer.from(JSON.stringify(packet)),totalChunks=Math.ceil(bytes.length/65536);let uploadId;
  for(let index=0;index<totalChunks;index++){const chunk=bytes.subarray(index*65536,(index+1)*65536);const result=await request('uploads',{uploadId,name:source+'-reviewed-history.json',bundleSha256:hash(bytes),totalBytes:bytes.length,totalChunks,index,chunkSha256:hash(chunk),base64:chunk.toString('base64')},{namespace:packet.namespace});uploadId=result.uploadId}return uploadId;
 }
 async function plan(inspection,review,options={}){
  const prepared=await prepare(inspection,review);
  if(prepared.summary.blocked||prepared.summary.needsOmissionReview)return prepared.summary;
  const uploadId=await upload(prepared.packet),dryRun=await request('plan',{uploadId,...(review.delta?{catchup:true}:{}),...(source==='slack'&&prepared.summary.cutover?{cutover:prepared.summary.cutover}:{})},{namespace:review.namespace,...options});
  return {...prepared.summary,...dryRun,counts:prepared.summary.counts,uploadId};
 }
 const apply=(plan,options={})=>request('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},options);
 async function finish(plan){let result;for(let n=0;n<200;n++){result=await apply(plan);if(result.job?.state==='completed')return result;if(result.job&&['failed','undone','rolled_back'].includes(result.job.state))break}assert.equal(result?.job?.state,'completed','reviewed import completes');return result}
 async function undo(plan){let result;for(let n=0;n<200;n++){result=await request('undo',{planId:plan.planId});if(['undone','rolled_back'].includes(result.job?.state))return result;if(result.job?.state==='failed')break}assert.ok(['undone','rolled_back'].includes(result?.job?.state),'guarded reversal completes');return result}
 return {request,inspect,prepare,upload,plan,apply,finish,undo,status:plan=>request('status',{planId:plan.planId}),history:options=>request('history?source='+source,undefined,options)};
}
