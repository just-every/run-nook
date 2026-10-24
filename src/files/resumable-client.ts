import {sha256} from '@noble/hashes/sha2.js';
const PART=8*1024*1024;
export async function fileChecksum(file:File){const hash=sha256.create();for(let offset=0;offset<file.size;offset+=PART)hash.update(new Uint8Array(await file.slice(offset,offset+PART).arrayBuffer()));return Array.from(hash.digest(),byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function resumableUpload(conversation:string,file:File,intent:string,mime:string){
 const call=async(path:string,init:RequestInit={})=>{const response=await fetch('/api/'+path,{...init,cache:'no-store'}),value=await response.json() as any;if(!response.ok)throw Object.assign(Error(value.error??'Upload failed'),{status:response.status});return value};
 let status=await call('conversations/'+encodeURIComponent(conversation)+'/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,mime,size:file.size,sha256:await fileChecksum(file),intent})});
 if(status.file)return status.file;
 for(let index=0;index<Math.ceil(file.size/PART);index++){
  if(status.parts.some((p:any)=>p.part===index+1))continue;
  status=await call('uploads/'+status.id+'/parts/'+(index+1),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(index*PART,(index+1)*PART)});
 }
 return (await call('uploads/'+status.id+'/complete',{method:'POST'})).file;
}
