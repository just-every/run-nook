import {isClipMime} from './media'
/** Validate the declared media container before admitting bytes to private storage. */
export function clipSignature(mime:string,bytes:Uint8Array){
 if(!isClipMime(mime))return false
 const starts=(values:number[],at=0)=>values.every((value,index)=>bytes[at+index]===value)
 const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.subarray(start,end))
 if(mime.endsWith('/webm'))return starts([0x1a,0x45,0xdf,0xa3])&&ascii(0,Math.min(bytes.length,4096)).includes('webm')
 if(mime.endsWith('/mp4'))return bytes.length>=16&&ascii(4,8)==='ftyp'&&/^(isom|iso[2-9]|mp4[12]|M4[AVBP] |avc1|dash|qt  )$/.test(ascii(8,12))
 if(mime==='audio/ogg')return ascii(0,4)==='OggS'&&/OpusHead|vorbis|Speex/.test(ascii(0,Math.min(bytes.length,4096)))
 if(mime==='audio/wav')return bytes.length>=44&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE'
 return mime==='audio/mpeg'&&(ascii(0,3)==='ID3'||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0&&(bytes[1]&0x18)!==0x08)
}
