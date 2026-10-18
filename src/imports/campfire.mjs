import {CAMPFIRE_SCHEMA} from './campfire-schema.mjs';
import { inflateRawSync } from 'node:zlib';
import initSqlJs from 'sql.js/dist/sql-asm.js';
import { crc32, canonicalPath } from './zip.mjs';
import { strictJson } from './json.mjs';
import { campfireReject as reject, campfireHash as hash, campfireRows as rows, campfireRecords, campfireDate } from './campfire-records.mjs';

export const CAMPFIRE_LIMITS=Object.freeze({archive:32*1024*1024,total:64*1024*1024,entry:16*1024*1024,entries:5000,ratio:200});
// Official Express bootstrap schema, including its initialization index. This
// identifies the supported schema, never a particular workspace's data.

const utf8=bytes=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('invalid UTF-8');}};
function gunzip(input){
  const b=Buffer.from(input),limits=CAMPFIRE_LIMITS;
  if(b.length<18||b.length>limits.archive||b[0]!==31||b[1]!==139||b[2]!==8||b[3]&0xe0)reject('gzip header or size');
  let p=10;const flags=b[3];
  if(flags&4){if(p+2>b.length-8)reject('gzip extra');const size=b.readUInt16LE(p);p+=2+size;}
  for(const flag of [8,16])if(flags&flag){while(p<b.length-8&&b[p]!==0)p++;if(p>=b.length-8)reject('gzip string');p++;}
  if(flags&2){if(p+2>b.length-8||b.readUInt16LE(p)!==(crc32(b.subarray(0,p))&65535))reject('gzip header checksum');p+=2;}
  if(p>=b.length-8)reject('truncated gzip');
  let inflated;try{inflated=inflateRawSync(b.subarray(p),{maxOutputLength:Math.min(limits.total,b.length*limits.ratio),info:true});}catch{reject('gzip compression or expansion limit');}
  const end=p+inflated.engine.bytesWritten,out=inflated.buffer;
  if(end+8!==b.length||b.readUInt32LE(end)!==crc32(out)||b.readUInt32LE(end+4)!==out.length)reject('gzip boundary or checksum');
  return out;
}
function octal(b){const s=b.toString('ascii').replace(/\0.*$/s,'').trim();if(!/^[0-7]*$/.test(s))reject('tar numeric field');const n=parseInt(s||'0',8);if(!Number.isSafeInteger(n))reject('tar numeric overflow');return n;}
function field(b){const end=b.indexOf(0);if(end>=0&&b.subarray(end).some(x=>x!==0))reject('tar string padding');return utf8(end<0?b:b.subarray(0,end));}
function pax(bytes){
  const result=new Map();let p=0;
  while(p<bytes.length){let space=bytes.indexOf(32,p);if(space<0||space-p>8)reject('PAX record');const lengthText=bytes.subarray(p,space).toString('ascii');
    if(!/^[1-9]\d*$/.test(lengthText))reject('PAX length');const end=p+Number(lengthText),equal=bytes.indexOf(61,space+1);
    if(end>bytes.length||equal<0||equal>=end||bytes[end-1]!==10)reject('PAX bounds');
    const key=bytes.subarray(space+1,equal).toString('ascii');if(result.has(key))reject('duplicate PAX key');
    if(!['path','mtime','atime','ctime','uid','gid','uname','gname','charset'].includes(key)&&!key.startsWith('LIBARCHIVE.xattr.')&&!key.startsWith('SCHILY.xattr.'))reject('unsupported PAX property');
    result.set(key,bytes.subarray(equal+1,end-1));p=end;
  }return result;
}
function tar(input){
  const bytes=gunzip(input),files=new Map(),seen=new Map(),metadata=[];let p=0,count=0,pending=null;
  while(p+512<=bytes.length){
    const h=bytes.subarray(p,p+512);if(h.every(x=>x===0)){if(pending||p+1024>bytes.length||bytes.subarray(p).some(x=>x!==0)||bytes.length%512)reject('tar end boundary');return {files,metadata};}
    if(++count>CAMPFIRE_LIMITS.entries||h.subarray(257,263).toString('ascii')!=='ustar\0')reject('tar type or entry limit');
    let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:h[i];if(checksum!==octal(h.subarray(148,156)))reject('tar checksum');
    const size=octal(h.subarray(124,136)),type=h[156],prefix=field(h.subarray(345,500)),name=field(h.subarray(0,100));
    if(size>CAMPFIRE_LIMITS.entry||p+512+Math.ceil(size/512)*512>bytes.length)reject('tar data bounds');
    const body=bytes.subarray(p+512,p+512+size);if(bytes.subarray(p+512+size,p+512+Math.ceil(size/512)*512).some(x=>x!==0))reject('tar data padding');p+=512+Math.ceil(size/512)*512;
    let path=prefix?`${prefix}/${name}`:name;
    if(type===120){if(pending)reject('stacked PAX metadata');canonicalPath(path);pending=pax(body);continue;}
    if(![0,48,53].includes(type)||field(h.subarray(157,257)))reject('tar link or special entry');
    if(pending?.has('path'))path=utf8(pending.get('path'));pending=null;
    const directory=type===53;if(directory&&size)reject('nonempty tar directory');if(directory&&path.endsWith('/'))path=path.slice(0,-1);
    canonicalPath(path);const alias=path.normalize('NFKC').toLocaleLowerCase('en-US');if(seen.has(alias))reject('duplicate or aliased tar path');seen.set(alias,directory);
    for(const [other,isDir]of seen){if(other!==alias&&(alias.startsWith(other+'/')&&!isDir||other.startsWith(alias+'/')&&!directory))reject('tar file-directory collision');}
    if(directory)continue;
    if(path.split('/').at(-1).startsWith('._')){
      if(body.length<26||body.readUInt32BE(0)!==0x00051607)reject('invalid AppleDouble metadata');metadata.push({kind:'entry',key:path,reason:'filesystem-metadata'});continue;
    }
    files.set(path,body);
  }reject('missing tar end marker');
}
function sqliteHeader(bytes){
  if(!bytes||bytes.length<100||Buffer.from(bytes).subarray(0,16).toString('ascii')!=='SQLite format 3\0')reject('SQLite snapshot required');
  const b=Buffer.from(bytes),raw=b.readUInt16BE(16),size=raw===1?65536:raw;
  if(size<512||size>65536||(size&(size-1))||b.length%size||b.readUInt32BE(28)!==b.length/size||![1,2].includes(b[18])||![1,2].includes(b[19]))reject('inconsistent SQLite header');
}
let engine;
export async function inspectCampfireBackup(input){
  try{
    const {files,metadata}=tar(input),manifest=files.get('storage/backup.json');if(!manifest)reject('declared Express backup required; Rails variant unsupported');
    const declaration=strictJson(utf8(manifest));
    if(!declaration||typeof declaration!=='object'||Array.isArray(declaration)||Object.keys(declaration).sort().join()!=='created_at,format,implementation'||declaration.format!==1||declaration.implementation!=='once-campfire-express')reject('unsupported backup declaration');
    campfireDate(declaration.created_at);
    for(const path of files.keys())if(!['storage/backup.json','storage/db/production.sqlite3','storage/db/jobs.sqlite3'].includes(path)&&!path.startsWith('storage/files/'))reject('unsupported archive member');
    const bytes=files.get('storage/db/production.sqlite3');sqliteHeader(bytes);
    const SQL=await(engine??=initSqlJs()),db=new SQL.Database(bytes);
    try{
      const schema=rows(db,"SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name"),schemaDigest=hash(JSON.stringify(schema));
      if(schemaDigest!==CAMPFIRE_SCHEMA||rows(db,'SELECT version FROM schema_migrations').length)reject('unsupported SQLite schema');
      const integrity=rows(db,'PRAGMA quick_check');if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok'||rows(db,'PRAGMA foreign_key_check').length)reject('SQLite integrity or foreign references');
      const accounts=rows(db,'SELECT COUNT(*) AS count FROM accounts');if(accounts[0].count!==1)reject('single Campfire account required');
      const records=campfireRecords(db,files);
      return {archiveDigest:hash(input),source:{implementation:declaration.implementation,format:1,schema:'express-bootstrap-v1',schemaDigest,schemaMigrations:[],createdAt:declaration.created_at},...records,omissions:[...metadata,...records.omissions]};
    }finally{db.close();}
  }catch(error){if(error instanceof Error&&error.message.startsWith('CAMPFIRE_INVALID:'))throw error;reject('unreadable or unsupported backup');}
}
