// Test-only vendor boundary. Native queue, authority, encryption and receipts run
// in the production Worker; this isolated module has no provider credentials.
const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const text=value=>new TextEncoder().encode(value);
const join=(...arrays)=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){out.set(a,at);at+=a.length}return out};
const require=(condition)=>{if(!condition)throw Error('Invalid native Web Push packet')};
async function hkdf(key,salt,info,length){return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},await crypto.subtle.importKey('raw',key,'HKDF',false,['deriveBits']),length*8))}
export default {async fetch(request,{fixture}){
 try{
  require(request.method==='POST'&&new URL(request.url).origin==='https://web.push.apple.com');
  require(request.headers.get('content-encoding')==='aes128gcm'&&request.headers.get('content-type')==='application/octet-stream'&&request.headers.get('ttl')==='300');
  const match=/^vapid t=([^,]+), k=(.+)$/.exec(request.headers.get('authorization')??'');require(match&&match[2]===fixture.publicKey);
  const [header,claims,signature]=match[1].split('.'),jwt=JSON.parse(new TextDecoder().decode(bytes(claims))),pub=bytes(match[2]);
  require(JSON.parse(new TextDecoder().decode(bytes(header))).alg==='ES256'&&jwt.aud==='https://web.push.apple.com'&&jwt.sub==='mailto:'+fixture.email&&jwt.exp>Date.now()/1000&&jwt.exp<Date.now()/1000+86400);
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:btoa(String.fromCharCode(...pub.slice(1,33))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),y:btoa(String.fromCharCode(...pub.slice(33))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  require(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes(signature),text(header+'.'+claims)));
  const body=new Uint8Array(await request.arrayBuffer());require(body.length>102&&body.length<=4096&&body[20]===65);
  const server=body.slice(21,86),privateKey=await crypto.subtle.importKey('jwk',fixture.recipient.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  const remote=await crypto.subtle.importKey('raw',server,{name:'ECDH',namedCurve:'P-256'},false,[]),shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:remote},privateKey,256));
  const ikm=await hkdf(shared,bytes(fixture.recipient.auth),join(text('WebPush: info\0'),bytes(fixture.recipient.publicKey),server),32),cek=await hkdf(ikm,body.slice(0,16),text('Content-Encoding: aes128gcm\0'),16),iv=await hkdf(ikm,body.slice(0,16),text('Content-Encoding: nonce\0'),12);
  const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),body.slice(86)));let end=plain.length-1;while(plain[end]===0)end--;require(plain[end]===2);
  const payload=JSON.parse(new TextDecoder().decode(plain.slice(0,end)));require(typeof payload.title==='string'&&typeof payload.body==='string'&&JSON.stringify(payload).includes(fixture.label));
  return new Response(null,{status:201,headers:{Location:'https://web.push.apple.com/receipt/'+crypto.randomUUID()}});
 }catch{return new Response('Invalid native Web Push payload',{status:400})}
}};
