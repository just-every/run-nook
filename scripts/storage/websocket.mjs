import {request} from 'node:http';
import {randomBytes} from 'node:crypto';
// Wire reader for the real Worker upgrade; handshake failure always releases its socket.
export function subscribe(origin,cookie,onHint){
 return new Promise((resolve,reject)=>{
  const url=new URL('/api/live',origin),req=request(url,{headers:{Origin:origin,Cookie:cookie,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Key':randomBytes(16).toString('base64'),'Sec-WebSocket-Version':'13'}});
  const timer=setTimeout(()=>req.destroy(Error('WebSocket upgrade timeout')),30000);
  req.on('error',error=>{clearTimeout(timer);reject(error)});
  req.on('response',response=>{clearTimeout(timer);response.destroy();req.destroy();reject(Error('WebSocket upgrade refused: '+response.statusCode))});
  req.on('upgrade',(_response,socket,head)=>{
   clearTimeout(timer);let bytes=head;
   const consume=chunk=>{
    bytes=Buffer.concat([bytes,chunk]);
    while(bytes.length>=2){
     let size=bytes[1]&127,offset=2;
     if(size===126){if(bytes.length<4)return;size=bytes.readUInt16BE(2);offset=4}
     else if(size===127){if(bytes.length<10)return;size=Number(bytes.readBigUInt64BE(2));offset=10}
     if(!Number.isSafeInteger(size)||size>1048576){socket.destroy(Error('Oversized fanout frame'));return}
     if(bytes.length<offset+size)return;
     const opcode=bytes[0]&15,body=bytes.subarray(offset,offset+size);bytes=bytes.subarray(offset+size);
     if(opcode===1){try{onHint(JSON.parse(body.toString()))}catch(error){socket.destroy(error);return}}
     else if(opcode===8){socket.end();socket.destroy()}
    }
   };
   socket.on('data',consume);socket.on('error',()=>{});consume(Buffer.alloc(0));
   // Close like a browser: send a masked 1000 close frame and wait for the peer.
   const close=()=>new Promise(done=>{
    if(socket.destroyed)return done();
    const timer=setTimeout(()=>{socket.destroy();done()},2000);
    socket.once('close',()=>{clearTimeout(timer);done()});
    const mask=randomBytes(4),payload=Buffer.from([0x03,0xe8]).map((byte,i)=>byte^mask[i%4]);
    socket.write(Buffer.concat([Buffer.from([0x88,0x82]),mask,payload]));
   });
   resolve({close,socket});
  });
  req.end();
 });
}
