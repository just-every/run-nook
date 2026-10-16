import assert from 'node:assert/strict';

// Messages exist only at the test's fake provider edge, never in application D1.
export const relay='https://mail-provider.example.test/send';
export const mailBindings={MAIL_PROVIDER:'rer',MAIL_FROM:'nook@example.test',MAIL_RELAY_URL:relay,MAIL_API_KEY:'synthetic-test-provider-key'};
const edges=new Map();
export function registerMailEdge(origin,edge){edges.set(origin,edge);return ()=>{if(edges.get(origin)===edge)edges.delete(origin)}}
export function deliveredMail(origin){const edge=edges.get(origin);assert.ok(edge,'test runtime registered its mail provider edge');return edge.messages}
export function confirmationLink(origin,email){
 const message=deliveredMail(origin).findLast(message=>message.to.toLowerCase()===email.toLowerCase()&&message.text.includes('/auth/confirm?'));
 assert.ok(message,'fake provider accepted a message for the requested person');
 const link=message.text.match(/https?:\/\/\S+\/auth\/confirm\?\S+/)?.[0];
 assert.ok(link,'provider message contains a native confirmation link');return new URL(link);
}
export function mailEdge(other){
 const messages=[],attempts=[];let status=202;
 return {messages,attempts,setStatus(value){status=value},async fetch(request){
  if(request.url!==relay){if(other)return other(request);throw Error('Unexpected outbound request at the test provider edge')}
  assert.equal(request.method,'POST');assert.equal(request.headers.get('authorization'),'Bearer '+mailBindings.MAIL_API_KEY);
  const body=await request.json();assert.equal(typeof body.to,'string');assert.ok(body.subject&&body.text);
  attempts.push({body,status,at:Date.now()});if(status===202)messages.push(body);
  return new Response(null,{status,headers:status===429?{'Retry-After':'15'}:{}});
 }};
}
