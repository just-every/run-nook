import {DatabaseSync} from 'node:sqlite';

/** Test network-edge registry. The actual platform SQL resolver and response
 * middleware run against SQLite; no URL parameter registers an application. */
export async function embeddingAuthority(source,state) {
 const {applyEditorEmbeddingHeaders}=await source.load('src/live-edits/embedding-headers.ts');
 const {canonical,sha256}=await source.load('src/delivery/contracts.ts');
 const database=new DatabaseSync(':memory:');
 database.exec(`CREATE TABLE installations(id TEXT PRIMARY KEY,status TEXT);
  CREATE TABLE delivery_targets(installation_id TEXT,environment TEXT,current_deployment_id TEXT,active_release_id TEXT,disconnected_at TEXT);
  CREATE TABLE delivery_releases(id TEXT,installation_id TEXT,environment TEXT,deployment_id TEXT,state TEXT,identity_json TEXT,identity_digest TEXT,receipt_json TEXT);
  INSERT INTO installations VALUES('nook-local','active');
  INSERT INTO delivery_targets VALUES('nook-local','production','fixture-deployment',NULL,NULL);`);
 const DB={prepare(sql){return {bind(...args){return {async all(){return {results:database.prepare(sql).all(...args)}}}}}}};
 return {
  async response(request,response) {
   const identity={installationId:'nook-local',environment:'production',source:'explicit-local-network-edge-fixture'};
   const digest=await sha256(canonical(identity));
   database.prepare('DELETE FROM delivery_releases').run();
   database.prepare('INSERT INTO delivery_releases VALUES(?,?,?,?,?,?,?,?)').run('fixture-release','nook-local','production','fixture-deployment',state.deny?'failed':'verified',JSON.stringify(identity),digest,JSON.stringify({verified:true,deploymentId:'fixture-deployment',releaseDigest:digest,applicationUrl:state.allowed}));
   return applyEditorEmbeddingHeaders(request,response,{DB,EDITOR_EMBEDDING_ENVIRONMENT:'production',EDITOR_EMBEDDING_LOCAL_TEST:true});
  },
  close:()=>database.close(),
 };
}
