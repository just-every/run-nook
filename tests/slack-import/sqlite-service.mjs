// Focused integration harness: production Context/service/Base SQL on SQLite.
// Only the object-provider edge is in memory; no alternate application paths.
import {teamFixture} from '../team-sql-support.mjs';
import {slackFixture} from './fixture.mjs';
import {importDoorClient,importUsers} from '../import-door-support.mjs';
export function testBucket() {
    const objects = new Map();
    return {
        async head(key) { const row = objects.get(key); return row ? { key, size: row.bytes.length, ...row.metadata } : null; },
        async get(key) { const row = objects.get(key); return row ? { ...await this.head(key), body: new Blob([row.bytes]).stream(), async arrayBuffer() { return Uint8Array.from(row.bytes).buffer; } } : null; },
        async put(key, value, metadata = {}) { const bytes = Buffer.from(await new Response(value).arrayBuffer()); objects.set(key, { bytes, metadata: structuredClone(metadata) }); return this.head(key); },
        async delete(key) { for (const k of Array.isArray(key) ? key : [key]) objects.delete(k); },
        async list({ prefix = '' } = {}) { return { objects: await Promise.all([...objects.keys()].filter(k => k.startsWith(prefix)).sort().map(k => this.head(k))), truncated: false }; }
    };
}
// The live hub is a Durable Object; undo only wakes it to drain queued object deletes.
export function testHub() { return { idFromName: () => '', get: () => ({ fetch: async () => new Response() }) }; }
export async function attachImportDoor(f,bucket=testBucket(),{source='slack',owner=f.owner,ownerCookie=f.ownerCookie,database=f.adapter,onRequest}={}){
    const {Context}=await import('../../src/platform/storage/context.ts'),{importDoor}=await import('../../src/imports/door.ts');
    const origin='http://127.0.0.1:15820';
    const env={DB:database,SESSION_SECRET:'synthetic-test-secret-at-least-thirty-two-characters',FILES:bucket,CHAT_HUB:testHub(),AUTH_ORIGIN:origin,AUTH_LOCAL:'true',OWNER_EMAIL:owner.operator.email,MAIL_PROVIDER:'development',MAIL_FROM:'nook@example.test'};
    const c=new Context(env,owner),door=importDoorClient({origin,owner:{cookie:ownerCookie,user:{id:owner.operatorId}},source,users:()=>importUsers(async sql=>(await database.prepare(sql).all()).results),transport:async(url,init)=>{const response=await importDoor(new Request(url,init),env);onRequest?.(url,response);return response}});
    return {...f,bucket,c,door};
}
export async function slackServiceFixture(){
    const f=await attachImportDoor(await teamFixture());
    async function preview(inspection,members=[f.owner.operatorId],namespace='archive-fixture'){
        const review={namespace,channels:[{sourceId:'C1',name:'Imported general',members},{sourceId:'C2',name:'Imported engineering',members:[f.owner.operatorId]}],actors:{U1:f.owner.operatorId,U2:null,U404:null},acceptedOmissions:[]};
        const local=await f.door.prepare(inspection,review);review.acceptedOmissions=[local.summary.omissionDigest];return f.door.plan(inspection,review);
    }
    return {...f,upload:()=>f.door.inspect(slackFixture()),preview,finish:plan=>f.door.finish(plan)};
}
