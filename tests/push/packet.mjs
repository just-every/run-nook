import assert from 'node:assert/strict';
import {createECDH,hkdfSync,createDecipheriv,createPublicKey,verify} from 'node:crypto';
export function subscriber(name){const key=createECDH('prime256v1');key.generateKeys();const auth=crypto.getRandomValues(new Uint8Array(16));return {key,auth,subscription:{endpoint:'https://web.push.apple.com/'+name,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.from(auth).toString('base64url')},expirationTime:null}}}
// An independent Node-crypto implementation verifies and decrypts the packet at
// the network boundary. It does not import the application's crypto or sender.
export async function packet(request,recipient,expectedKey){
 assert.equal(request.method,'POST');assert.equal(request.headers.get('content-encoding'),'aes128gcm');
 const match=/^vapid t=([^,]+), k=(.+)$/.exec(request.headers.get('authorization'));assert.ok(match);assert.equal(match[2],expectedKey);
 const [head,claims,signature]=match[1].split('.'),header=JSON.parse(Buffer.from(head,'base64url')),jwt=JSON.parse(Buffer.from(claims,'base64url'));
 assert.equal(header.alg,'ES256');assert.equal(jwt.aud,new URL(request.url).origin);assert.equal(jwt.sub,'mailto:owner@example.test');assert.ok(jwt.exp>Date.now()/1000&&jwt.exp<Date.now()/1000+86400);
 const pub=Buffer.from(expectedKey,'base64url'),publicKey=createPublicKey({key:{kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url')},format:'jwk'});
 assert.ok(verify('sha256',Buffer.from(head+'.'+claims),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),'VAPID signature valid');
 const bytes=Buffer.from(await request.arrayBuffer()),salt=bytes.subarray(0,16),recordSize=bytes.readUInt32BE(16),length=bytes[20],server=bytes.subarray(21,21+length);assert.ok(recordSize>=bytes.length-21-length);
 const shared=recipient.key.computeSecret(server),info=Buffer.concat([Buffer.from('WebPush: info\0'),recipient.key.getPublicKey(),server]),ikm=Buffer.from(hkdfSync('sha256',shared,recipient.auth,info,32));
 const cek=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),nonce=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12),encrypted=bytes.subarray(21+length),decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(encrypted.subarray(-16));
 const plain=Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]);let end=plain.length-1;while(plain[end]===0)end--;assert.equal(plain[end],2,'final encrypted record delimiter');return JSON.parse(plain.subarray(0,end));
}
