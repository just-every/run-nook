import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {currentOwner} from '../exit/authority'
export const DEFAULT_FILE_LIMIT=25*1024*1024
export type FilePolicy={version:number;max_bytes:number;blocked_json:string}
export const noFileWriters="NOT EXISTS(SELECT 1 FROM nook_upload_attempts) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE state='reserved') AND NOT EXISTS(SELECT 1 FROM nook_import_objects WHERE state='reserved')"
export const filePolicyVersion='COALESCE((SELECT version FROM nook_file_policy WHERE id=1),0)'
export async function readFilePolicy(db:D1Database):Promise<FilePolicy>{return await db.prepare('SELECT version,max_bytes,blocked_json FROM nook_file_policy WHERE id=1').first<FilePolicy>()??{version:0,max_bytes:DEFAULT_FILE_LIMIT,blocked_json:'[]'}}
export function enforceFilePolicy(policy:FilePolicy,name:string,size:number){
 if(size>policy.max_bytes)fail(413,`Workspace file policy: maximum file size is ${policy.max_bytes} bytes`)
 const normalized=name.normalize('NFKC').toLowerCase().replace(/[.\s]+$/g,'')
 const blocked=(JSON.parse(policy.blocked_json) as string[]).find(extension=>normalized.endsWith('.'+extension))
 if(blocked)fail(415,`Workspace file policy: .${blocked} files are blocked`)
}
const project=(row:FilePolicy)=>({version:row.version,maxBytes:row.max_bytes,blockedExtensions:JSON.parse(row.blocked_json) as string[]})
export async function filePolicy(c:Context){if(!await c.one(`SELECT 1 WHERE ${currentOwner('?')}`,[c.uid]))fail(403,'Only owners manage file policy');return project(await readFilePolicy(c.db))}
export async function updateFilePolicy(c:Context,input:Record<string,unknown>){
 await filePolicy(c)
 if(Object.keys(input).sort().join()!=='blockedExtensions,maxBytes,version'||!Number.isSafeInteger(input.version)||Number(input.version)<0||!Number.isSafeInteger(input.maxBytes)||Number(input.maxBytes)<1||Number(input.maxBytes)>DEFAULT_FILE_LIMIT||!Array.isArray(input.blockedExtensions)||input.blockedExtensions.length>50||input.blockedExtensions.some(value=>typeof value!=='string'||!/^\.?[a-zA-Z0-9][a-zA-Z0-9._+-]{0,31}$/.test(value)||value.endsWith('.')))fail(400,'Choose a size from 1 byte to 25 MiB and at most 50 file extensions, with the current version')
 const extensions=[...new Set((input.blockedExtensions as string[]).map(value=>value.replace(/^\./,'').toLowerCase()))].sort(),version=Number(input.version)
 if((await readFilePolicy(c.db)).version!==version)fail(409,'File policy changed; reload before saving')
 // The same version is fenced when each byte-writing door claims its attempt.
 // Refuse a policy change while an R2 writer could still be in flight.
 if(!await c.one(`SELECT 1 WHERE ${noFileWriters}`))fail(409,'Uploads are in progress; finish or reconcile them before changing file policy')
 await c.batch([
  c.sql('UPDATE nook_file_policy SET version=version+1,max_bytes=?,blocked_json=? WHERE id=1',input.maxBytes,JSON.stringify(extensions)),
  c.sql("INSERT INTO nook_audit VALUES(?,?,'file-policy',?,'policy.files','workspace',?,?,'confirmed',?)",crypto.randomUUID(),c.uid,Date.now(),version+1,`Maximum file size: ${input.maxBytes} bytes; blocked extensions: ${extensions.map(x=>'.'+x).join(', ')||'none'}`,extensions.length),
 ],undefined,`${currentOwner('?')} AND ${filePolicyVersion}=? AND ${noFileWriters}`,[c.uid,version])
 await c.hint();return filePolicy(c)
}
