import {createServer} from 'node:net'

// The OS allocates the first HTTP port; subsequent starts retain that origin
// because persisted sessions and archive workflow proofs refer to it.
export async function freePort(){
 const socket=createServer()
 await new Promise((ok,bad)=>{socket.once('error',bad);socket.listen(0,'127.0.0.1',ok)})
 const {port}=socket.address()
 await new Promise(ok=>socket.close(ok))
 return port
}

export async function released(port){
 for(let i=0;i<240;i++){
  const free=await new Promise((ok,bad)=>{
   const socket=createServer()
   socket.once('error',error=>error.code==='EADDRINUSE'?ok(false):bad(error))
   socket.listen(port,'127.0.0.1',()=>socket.close(()=>ok(true)))
  })
  if(free)return
  await new Promise(ok=>setTimeout(ok,125))
 }
 throw Error(`The previous app still holds port ${port}`)
}
