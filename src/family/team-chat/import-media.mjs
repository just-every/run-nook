import {createHash} from 'node:crypto';
import {Fault} from './fault.mjs';
export const MAX_FILE_BYTES=25*1024*1024,MAX_WORKSPACE_BYTES=30*1024*1024;
export function validateUpload(input){
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||/[\x00-\x1f\x7f\\/<>:"|?*]/.test(input.name))throw new Fault(400,'Invalid filename');
 if(!['text/plain','image/png','image/jpeg','application/pdf'].includes(input.mime))throw new Fault(415,'Unsupported file type; no HTML or SVG previews');
 if(typeof input.data!=='string'||input.data.length>Math.ceil(MAX_FILE_BYTES/3)*4||!input.data||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))throw new Fault(400,'Invalid bounded base64 upload');
 let bytes=Buffer.from(input.data,'base64');if(!bytes.length||bytes.length>MAX_FILE_BYTES||bytes.toString('base64')!==input.data)throw new Fault(400,'Invalid upload bytes');
 const starts=s=>bytes.subarray(0,s.length).equals(Buffer.from(s));
 if(input.mime==='image/png'&&!starts([137,80,78,71,13,10,26,10])||input.mime==='image/jpeg'&&!starts([255,216,255])||input.mime==='application/pdf'&&!starts('%PDF-'))throw new Fault(415,'Declared file type does not match signature');
 if(input.mime==='text/plain'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Fault(415,'Plain text must be valid UTF-8')}if(bytes.includes(0))throw new Fault(415,'Plain text contains binary bytes')}
 return {name:input.name.trim(),mime:input.mime,bytes,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export const metadata=({data,bytes,...item})=>item;
