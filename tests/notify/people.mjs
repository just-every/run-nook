import assert from 'node:assert/strict';
const unescape=text=>text.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"');
// Ordinary outbox sign-in (request, read the link, native POST confirmation) and
// a JSON client that carries the resulting session cookie.
export function people({origin,key}){
 const headers={'x-rer-dev-key':key};
 async function confirm(email){
  const listing=await(await fetch(origin+'/__dev/outbox',{headers})).text();
  const article=listing.split('<article>').slice(1).find(row=>row.toLowerCase().includes(`to: ${email}</p>`));assert.ok(article,'outbox holds the sign-in link');
  const detail=await(await fetch(new URL(unescape(article.match(/href="([^"]*\?message=[^"]+)"/)[1]),origin),{headers})).text();
  const page=await(await fetch(new URL(unescape(detail.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)[1]),origin))).text();
  const done=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unescape(page.match(/name="token" value="([^"]+)"/)[1])})});
  assert.equal(done.status,303,'native confirmation signs in');return client(done.headers.get('set-cookie').split(';')[0]);
 }
 function client(cookie){
  const call=async(method,path,body,status=200)=>{const response=await fetch(origin+path,{method,headers:{Origin:origin,cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json().catch(()=>null);assert.equal(response.status,status,`${method} ${path}`);return value;};
  return {cookie,get:path=>call('GET',path),post:(path,body,status)=>call('POST',path,body,status),patch:(path,body,status)=>call('PATCH',path,body,status)};
 }
 async function signIn(email){const asked=await fetch(origin+'/auth/magic-link',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,returnTo:'/app'})});assert.equal(asked.status,202);const person=await confirm(email);person.user=await person.get('/api/me');return person;}
 async function invite(owner,name,scopes){
  const email=name.toLowerCase()+'@example.test';
  await owner.post('/api/team/invitations',{email,role:'member',mode:'member',scopes});
  const sent=await fetch(origin+'/auth/invite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie:owner.cookie},body:JSON.stringify({email,displayName:name,role:'member',returnTo:'/app'})});assert.equal(sent.status,202);
  const person=await confirm(email);person.user=await person.get('/api/me');person.email=email;return person;
 }
 return {signIn,invite};
}
