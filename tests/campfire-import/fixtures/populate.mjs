// Populate an empty, genuine upstream Campfire Express server through HTTP only.
// Passwords and cookies live only in memory. No application database writes here.
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const origin = process.env.CAMPFIRE_FIXTURE_ORIGIN || 'http://127.0.0.1:25543';
const clients = Array.from({length: 4}, () => new Map());
async function request(client, path, body, method = body ? 'POST' : 'GET') {
  const headers = { accept: 'application/json', cookie: [...clients[client]].map(([k,v]) => `${k}=${v}`).join('; ') };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(origin + path, {method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined, redirect: 'manual'});
  for (const row of response.headers.getSetCookie()) {
    const first = row.split(';')[0], split = first.indexOf('=');
    clients[client].set(first.slice(0,split),first.slice(split+1));
  }
  const text = await response.text();
  if (response.status >= 400) throw Error(`Upstream fixture request failed (${response.status}, operation ${method})`);
  return {status: response.status, location: response.headers.get('location'), text};
}
const people = [
  ['Maya Chen','maya@campfire-fixture.test'],
  ['Leo Martin','leo@campfire-fixture.test'],
  ['Aisha Patel','aisha@campfire-fixture.test'],
  ['Sam Rivera','sam@campfire-fixture.test'],
];
function credentials(i) { return {user:{name:people[i][0],email_address:people[i][1],password:randomBytes(32).toString('base64url')}}; }
await request(0,'/first_run',credentials(0));
const account = await request(0,'/account');
const join = account.text.match(/\/join\/([A-Za-z0-9_-]+)/)?.[0];
if (!join) throw Error('Upstream account page did not expose its join link');
for (let i=1;i<people.length;i++) await request(i,join,credentials(i));
const rooms = [];
async function room(actor,kind,name,ids) {
  const result = await request(actor,`/rooms/${kind}`,{room:{name},user_ids:ids});
  const id = Number(result.location?.match(/^\/rooms\/(\d+)$/)?.[1]);
  if (!id) throw Error('Upstream room creation did not redirect to a room');
  rooms.push({id,type:kind,name,participants:ids});
  return id;
}
// The first-run wizard creates All Talk (room 1); all four users join it.
rooms.push({id:1,type:'opens',name:'All Talk',participants:[1,2,3,4]});
const open = await room(0,'opens','Project Lantern',[1,2,3,4]);
const closed = await room(0,'closeds','Budget planning',[1,2]);
const direct = await room(1,'directs',null,[2,3]);
const group = await room(0,'directs',null,[1,2,3]);
const expected = [];
async function message(actor,room,body,file) {
  let payload = {message:{body}};
  if (file) {
    payload = new FormData();
    payload.append('message[body]',body);
    payload.append('message[attachment]',new Blob([file.bytes],{type:file.mime}),file.name);
  }
  const response = await request(actor,`/rooms/${room}/messages`,payload);
  const source = JSON.parse(response.text);
  if (response.status !== 201 || !source.id) throw Error('Upstream message was not created');
  expected.push({id:source.id,room,creator:actor+1,body,...(file ? {file:{name:file.name,mime:file.mime,text:file.bytes}} : {})});
}
await message(0,1,'<div>Welcome to the Lantern team.</div>');
await message(0,open,'<div>Kickoff is Tuesday. Café notes and 日本語 are welcome.</div>');
await message(1,open,'<div>I will bring the launch checklist.</div>',{name:'launch-checklist.txt',mime:'text/plain',bytes:'Lantern launch checklist\n1. Review accessibility\n2. Confirm launch owner\n'});
await message(2,open,'<div>Accessibility review is ready.<br>Thank you, everyone.</div>');
await message(0,closed,'<div>Budget planning: keep the supplier estimate within this room.</div>');
await message(1,closed,'<div>Draft estimate attached.</div>',{name:'supplier-estimate.csv',mime:'text/csv',bytes:'item,amount,currency\nLaunch materials,275,AUD\n'});
await message(1,direct,'<div>Aisha, can you review the launch announcement?</div>');
await message(2,direct,'<div>Yes. I will send edits this afternoon.</div>');
await message(0,group,'<div>This small group owns the final launch decision.</div>');
await message(2,group,'<div>The handover note is attached.</div>',{name:'handover.txt',mime:'text/plain',bytes:'Lantern handover\nMaya: launch owner\nLeo: communications\nAisha: accessibility\n'});
for (const id of [closed,direct,group]) {
  const denied = await request(3,`/rooms/${id}/messages`);
  if (denied.status !== 302 || denied.location !== '/') throw Error('Upstream outsider obtained private room history');
}
const ownerDenied = await request(0,`/rooms/${direct}/messages`);
if (ownerDenied.status !== 302 || ownerDenied.location !== '/') throw Error('Upstream administrator obtained another pair’s DM');
for (let i=0;i<people.length;i++) await request(i,'/session',undefined,'DELETE');
await writeFile(new URL('./population.json',import.meta.url),JSON.stringify({people:people.map(([name,email],i)=>({id:i+1,name,email})),rooms,messages:expected,upstreamAclChecks:{unrelatedUserDenied:[closed,direct,group],administratorDeniedOtherPeoplesDm:direct},transport:'real upstream HTTP routes; no direct database writes'},null,2)+'\n');
console.log(`Created ${people.length} users, ${rooms.length} rooms, ${expected.length} messages and 3 originals through upstream HTTP; logged out every user.`);
