// A request body as UTF-8 text, or null when it is over `max` bytes or not valid UTF-8.
export async function readText(request:Request,max:number){
 const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
 if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return null}chunks.push(value)}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return null}
}
