import assert from 'node:assert/strict';
import {signIn as operatorSignIn} from '../auth-support.mjs';
// Native auth through the fake network provider and real confirmation routes.
export function people({origin}){
 async function confirm(email){return client((await operatorSignIn(origin,email,{requestLink:false})).cookie)}
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
