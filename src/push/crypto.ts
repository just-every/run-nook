// RFC 8291 / RFC 8292, using only Worker Web Crypto. No credentials in errors.
export const utf8=(value:string)=>new TextEncoder().encode(value)
export const b64=(value:BufferSource)=>btoa(String.fromCharCode(...new Uint8Array(value instanceof ArrayBuffer?value:value.buffer,value instanceof ArrayBuffer?0:value.byteOffset,value instanceof ArrayBuffer?value.byteLength:value.byteLength))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
export function unb64(value:string){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid key');const out=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(b64(out)!==value)throw Error('Invalid key');return out}
export function concat(...values:Uint8Array[]){const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let at=0;for(const value of values){out.set(value,at);at+=value.length}return out}
async function hkdf(key:BufferSource,salt:BufferSource,info:BufferSource,length:number){return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},await crypto.subtle.importKey('raw',key,'HKDF',false,['deriveBits']),length*8))}
export async function encrypt(subscription:{keys:{p256dh:string;auth:string}},payload:string){
 const recipient=unb64(subscription.keys.p256dh),auth=unb64(subscription.keys.auth)
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),server=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))
 const pub=await crypto.subtle.importKey('raw',recipient,{name:'ECDH',namedCurve:'P-256'},false,[])
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:pub},pair.privateKey,256)
 const ikm=await hkdf(shared,auth,concat(utf8('WebPush: info\0'),recipient,server),32),salt=crypto.getRandomValues(new Uint8Array(16))
 const key=await hkdf(ikm,salt,utf8('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(ikm,salt,utf8('Content-Encoding: nonce\0'),12)
 const plain=concat(utf8(payload),new Uint8Array([2]));if(plain.length+16+86>4096)throw Error('Push payload too large')
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']),plain)
 return concat(salt,new Uint8Array([0,0,16,0,server.length]),server,new Uint8Array(ciphertext))
}
async function wrapping(secret:string){if(typeof secret!=='string'||secret.length<32)throw Error('Push secret unavailable');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf8('nook.webpush.v1\0'+secret)),'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(value:JsonWebKey,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(concat(iv,new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8('nook-vapid-v1')},await wrapping(secret),utf8(JSON.stringify(value))))))}
export async function unseal(value:string,secret:string):Promise<JsonWebKey>{const bytes=unb64(value);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:utf8('nook-vapid-v1')},await wrapping(secret),bytes.slice(12))))}
export async function vapid(env:any){
 let row=await env.DB.prepare('SELECT public_key,sealed_private FROM nook_push_secrets WHERE id=1').first()
 if(!row){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const publicKey=b64(await crypto.subtle.exportKey('raw',pair.publicKey)),sealed=await seal(await crypto.subtle.exportKey('jwk',pair.privateKey),env.SESSION_SECRET);await env.DB.prepare('INSERT OR IGNORE INTO nook_push_secrets VALUES(1,?,?)').bind(publicKey,sealed).run();row=await env.DB.prepare('SELECT public_key,sealed_private FROM nook_push_secrets WHERE id=1').first()}
 return {publicKey:row.public_key as string,privateKey:await unseal(row.sealed_private,env.SESSION_SECRET)}
}
export async function authorization(endpoint:string,origin:string,keys:Awaited<ReturnType<typeof vapid>>,now:number){
 const head=b64(utf8(JSON.stringify({typ:'JWT',alg:'ES256'}))),claims=b64(utf8(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:origin}))),input=head+'.'+claims
 const key=await crypto.subtle.importKey('jwk',keys.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign'])
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8(input))
 return 'vapid t='+input+'.'+b64(signature)+', k='+keys.publicKey
}
