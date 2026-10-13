// A deliberately small format reader, independent of an upload's claimed MIME.
// It accepts structurally valid PNG and baseline/progressive JPEG containers;
// pixel decoding remains the browser's inert image decoder, never an HTML embed.
function crc32(bytes,start,end){let crc=0xffffffff;for(let i=start;i<end;i++){crc^=bytes[i];for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
export function safeImageType(bytes){
 if(!(bytes instanceof Uint8Array))return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=45&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)){
  let pos=8,header=false,data=false;
  while(pos+12<=bytes.length){const size=view.getUint32(pos),end=pos+8+size;if(end+4>bytes.length)return null;const kind=String.fromCharCode(...bytes.subarray(pos+4,pos+8));if(!/^[A-Za-z]{4}$/.test(kind)||crc32(bytes,pos+4,end)!==view.getUint32(end))return null;
   if(!header){if(kind!=='IHDR'||size!==13)return null;const w=view.getUint32(pos+8),h=view.getUint32(pos+12);if(!w||!h||w>16384||h>16384||w*h>40000000)return null;header=true}
   else if(kind==='IHDR')return null;
   if(kind==='IDAT'&&size>0)data=true;
   if(kind==='IEND')return size===0&&data&&end+4===bytes.length?'image/png':null;
   pos=end+4;
  }
  return null;
 }
 if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){
  let pos=2,frame=false,scan=false;
  while(pos+1<bytes.length){if(bytes[pos++]!==255)return null;while(bytes[pos]===255)pos++;const marker=bytes[pos++];
   if(marker===0xd9)return frame&&scan&&pos===bytes.length?'image/jpeg':null;
   if(pos+2>bytes.length)return null;const size=view.getUint16(pos);if(size<2||pos+size>bytes.length)return null;
   if([0xc0,0xc1,0xc2].includes(marker)){if(size<8)return null;const h=view.getUint16(pos+3),w=view.getUint16(pos+5);if(!h||!w||w>16384||h>16384||w*h>40000000)return null;frame=true}
   pos+=size;
   if(marker===0xda){if(!frame)return null;scan=true;while(pos+1<bytes.length){if(bytes[pos]!==255){pos++;continue}if(bytes[pos+1]===0||bytes[pos+1]>=0xd0&&bytes[pos+1]<=0xd7){pos+=2;continue}break}}
  }
 }
 return null;
}
