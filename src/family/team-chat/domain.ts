import {attentionEmpty,messageAttentionInput,preferences,settings,attentionList,attentionMutation,routeMessage,routeOutcome,type AttentionFields} from './attention'
import {metadata,erase,type Attachment} from './attachments'
// Pure family policy. No HTTP, storage, credentials, or UI dependencies.
import {Fault} from './fault.mjs'
export {Fault} from './fault.mjs'
export const fail = (status: number, message: string): never => { throw new Fault(status, message) }
export const text = (v: unknown, max = 8000): string => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : fail(400, 'Invalid text')
export const MESSAGE_LIMIT = 40000
export const messageBody = (value:unknown):string => {
 if(typeof value!=='string'||!value.trim())return fail(400,'Invalid text')
 if(value.length>MESSAGE_LIMIT)return fail(400,'message_too_long')
 return value.trim()
}
export type User = { id: string; name: string; active: boolean; email?: string; role?: 'owner'|'admin'|'member'; salt?: string; hash?: string; algorithm?: 'pbkdf2'|'scrypt' }
export type Identity = Pick<User, 'id' | 'name'>
export type Conversation = { id: string; name: string; kind: string; owner: string; seq: number; members: string[] }
export type Message = { id: string; conversation: string; author: string; body: string; parent: string | null; version: number; deleted: number; created: string; intent: string; payload: string; sequence: number }
export type Outcome = { id: string; conversation: string; author: string; assignee: string | null; kind: string; body: string; source: string | null; source_version: number | null; version: number; status: string; deadline: string | null }
export type State = AttentionFields & { schemaVersion: 4; imports: any[]; attachments:Attachment[]; users: User[]; sessions: { hash: string; user: string; expires: number }[]; conversations: Conversation[]; messages: Message[]; revisions: { message: string; version: number; body: string; at: string }[]; events: { conversation: string; seq: number; kind: string; object: string }[]; outcomes: Outcome[]; outcome_versions: { outcome: string; version: number; actor: string; body: string; status: string; deadline: string | null }[]; reads: { conversation: string; user: string; seq: number }[] }
export const empty = (): State => ({ ...attentionEmpty(),schemaVersion: 4, imports:[], attachments:[], users: [], sessions: [], conversations: [], messages: [], revisions: [], events: [], outcomes: [], outcome_versions: [], reads: [] })
export const auth = (s: State, hash: string, now: number): Identity => {
 const session = s.sessions.find(x => x.hash === hash && x.expires > now)
 const u = s.users.find(x => x.id === session?.user && x.active)
 return u ? { id: u.id, name: u.name } : fail(401, 'Sign in required')
}
export const acl = (s: State, u: Identity, id: string): Conversation => s.conversations.find(c => c.id === id && c.members.includes(u.id)) ?? fail(403, 'Conversation access denied')
const visibleMessage = (s:State,{ payload, ...m }: Message) => ({...m,attachments:s.attachments.filter(a=>a.message===m.id).map(metadata)})
const deadlineValue = (value: unknown): string | null => {
 if (!value) return null
 return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : fail(400, 'Invalid deadline')
}
export function query(s: State, u: Identity, action: string, id = '', input: Record<string, any> = {}): any {
 if(action==='settings')return settings(s,u)
 if(action==='attention')return attentionList(s,u)
 if(action==='preferences')return preferences(s,u,id)
 if (action === 'me') return u
 if (action === 'users') return s.users.filter(x => x.active).map(({ id, name }) => ({ id, name }))
 if (action === 'conversations') return s.conversations.filter(c => c.members.includes(u.id)).map(({ members, ...c }) => { const readSeq = s.reads.find(r => r.user === u.id && r.conversation === c.id)?.seq ?? 0; return { ...c, readSeq, unread: c.seq - readSeq } })
 if (action === 'search') { const q = text(input.q, 128).toLowerCase(); return s.messages.filter(m => !m.deleted && s.conversations.some(c => c.id === m.conversation && c.members.includes(u.id)) && m.body.toLowerCase().includes(q)).sort((a,b) => b.created.localeCompare(a.created)).slice(0,100).map(m => ({ id: m.id, conversation: m.conversation, body: m.body, parent: m.parent, authorName: s.users.find(u => u.id === m.author)?.name })) }
 const c = acl(s, u, id)
 if (action === 'members') return c.members.map(uid => { const u = s.users.find(x => x.id === uid)!; return { id: u.id, name: u.name } })
 if (action === 'replay') { const after = input.after ?? 0; if (!Number.isSafeInteger(after) || after < 0 || after > c.seq) fail(400,'Invalid cursor'); const events = s.events.filter(e => e.conversation === id && e.seq > after).slice(0,100); return { events, cursor: events.at(-1)?.seq ?? after, frontier: c.seq, hasMore: events.length === 100 } }
 if (action === 'messages') { const after = input.after ?? '', limit = input.limit ?? 100; if (typeof after !== 'string' || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail(400,'Invalid history page'); let cursor = 0; if (after) { const m = s.messages.find(m => m.conversation === id && m.created + m.id === after) ?? fail(400,'History cursor unavailable'); cursor = m.sequence } return s.messages.filter(m => m.conversation === id && m.sequence > cursor).slice(0,limit).map(m => ({ ...visibleMessage(s,m), authorName: s.users.find(u => u.id === m.author)?.name })) }
 if (action === 'outcomes') return s.outcomes.filter(o => o.conversation === id).map(o => ({ ...o, authorName: s.users.find(u => u.id === o.author)?.name, assigneeName: s.users.find(u => u.id === o.assignee)?.name ?? null, sourceState: !o.source ? o.source_version !== null ? 'deleted' : 'none' : s.messages.find(m => m.id === o.source)?.version !== o.source_version ? 'changed' : 'current' }))
 return fail(404,'Not found')
}
export function mutate(s: State, u: Identity, action: string, id: string, input: Record<string, any>, newId: string, now: string): any {
 if(['settings','preferences','follow','attentionAction'].includes(action))return attentionMutation(s,u,action,id,input,Date.parse(now))
 const event = (c: Conversation, kind: string, object: string) => { c.seq++; s.events.push({ conversation: c.id, seq: c.seq, kind, object }); return c.seq }
 if (action === 'conversations') {
  if (input.participants !== undefined && (!Array.isArray(input.participants) || input.participants.some((p: any) => typeof p !== 'string'))) fail(400,'Invalid participants')
  const name = text(input.name,80), kind = input.kind || 'channel'; if (!['channel','private','dm'].includes(kind)) fail(400,'Invalid conversation kind')
  const members: string[] = [...new Set<string>([u.id,...(input.participants ?? [])])]; if (members.length > 50) fail(400,'Too many participants')
  for (const uid of members) if (!s.users.some(x => x.id === uid && x.active)) fail(400,'Unknown participant')
  if (kind === 'dm' && members.length < 2) fail(400,'DM requires another participant')
  const c = { id: newId, name, kind, owner: u.id, seq: 0, members }; s.conversations.push(c); const {members: ignored,...result} = c; return result
 }
 if (action === 'edit') {
  if (input.delete !== undefined && typeof input.delete !== 'boolean') fail(400,'delete must be boolean')
  const m = s.messages.find(x => x.id === id) ?? fail(404,'Message missing'), c = acl(s,u,m.conversation)
  if (m.author !== u.id) fail(403,'Only author may edit'); if (m.deleted) fail(409,'Message deleted'); if (input.version !== m.version) fail(409,'Message changed; reload')
  m.body = input.delete ? '' : messageBody(input.body); m.version++; m.deleted = input.delete ? 1 : 0
  if (input.delete) { for(const a of s.attachments)if(a.message===id)erase(a); m.payload = '[erased]'; s.revisions = s.revisions.filter(r => r.message !== id); for (const o of s.outcomes) if (o.source === id) o.source = null }
  s.revisions.push({ message: id, version: m.version, body: m.body, at: now }); event(c,input.delete ? 'delete' : 'edit',id); return visibleMessage(s,m)
 }
 if (action === 'reviseOutcome') {
  if (input.assignee !== undefined || input.conversation !== undefined) fail(400,'Assignee and conversation scope are immutable; cancel and propose a new commitment')
  const o = s.outcomes.find(o => o.id === id) ?? fail(404,'Outcome missing'), c = acl(s,u,o.conversation)
  if (input.version !== o.version) fail(409,'Outcome changed; reload')
  if (input.action === 'cancel') { if (o.author !== u.id || ['cancelled','reported-complete'].includes(o.status)) fail(403,'Only author may cancel unfinished outcome'); o.status = 'cancelled' }
  else if (input.action === 'accept') { if (o.kind !== 'commitment' || o.assignee !== u.id || o.status !== 'proposed') fail(403,'Only assignee may accept a proposal'); o.status = 'accepted' }
  else if (input.action === 'complete') { if (o.assignee !== u.id || o.status !== 'accepted') fail(403,'Only accepted assignee may report completion'); o.status = 'reported-complete' }
  else { if (o.author !== u.id) fail(403,'Only author may revise'); if (['cancelled','reported-complete'].includes(o.status)) fail(409,'Outcome is terminal'); o.body = text(input.body); if (input.deadline !== undefined) o.deadline = deadlineValue(input.deadline); o.status = o.kind === 'commitment' ? 'proposed' : 'recorded' }
  o.version++; s.outcome_versions.push({ outcome: id, version: o.version, actor: u.id, body: o.body, status: o.status, deadline: o.deadline }); const seq=event(c,'outcome',id);routeOutcome(s,u,o,seq,newId,now); return o
 }
 const c = acl(s,u,id)
 if (action === 'members') {
  const uid = text(input.user,128); if (input.remove !== undefined && typeof input.remove !== 'boolean') fail(400,'remove must be boolean')
  if (c.owner !== u.id || c.kind === 'dm') fail(403,'Only channel owner may change membership; DMs are fixed')
  if (uid === u.id) fail(400,'Owner cannot remove themselves'); if (!s.users.some(x => x.id === uid && x.active)) fail(400,'Unknown member')
  c.members = input.remove ? c.members.filter(x => x !== uid) : [...new Set([...c.members,uid])]; event(c,'membership',uid); return {ok:true}
 }
 if (action === 'messages') {
  if (input.parent !== undefined && input.parent !== null && typeof input.parent !== 'string') fail(400,'Invalid parent')
  const body = messageBody(input.body), intent = text(input.intent,128), parent = input.parent || null
  if(input.attachments!==undefined&&(!Array.isArray(input.attachments)||input.attachments.length>5||input.attachments.some((x:any)=>typeof x!=='string')||new Set(input.attachments).size!==input.attachments.length))fail(400,'Invalid attachment IDs')
  const ids:string[]=input.attachments??[]
  const attentionPayload=messageAttentionInput(input)
  const payload = JSON.stringify({ body,parent,attachments:ids,...attentionPayload }), old = s.messages.find(m => m.conversation === id && m.author === u.id && m.intent === intent)
  if (old) { if (old.payload !== payload) fail(409,'Intent payload changed'); return visibleMessage(s,old) }
  if(parent&&!s.messages.some(m=>m.id===parent&&m.conversation===id&&!m.parent&&!m.deleted))fail(400,'Thread root unavailable')
  for(const uid of attentionPayload.mentions)if(!c.members.includes(uid))fail(400,'Mention recipient must be a current member')
  for(const aid of ids){const a=s.attachments.find(a=>a.id===aid);if(!a||a.conversation!==id||a.author!==u.id||a.state!=='staged'||a.expires<Date.parse(now))fail(400,'Attachment must be uploader-owned staged file in this conversation')}
  for(const aid of ids){const a=s.attachments.find(a=>a.id===aid)!;a.state='attached';a.message=newId}
  const m: Message = { id: newId, conversation: id, author: u.id, body, parent, version: 1, deleted: 0, created: now, intent, payload, sequence: event(c,'message',newId) }
  s.messages.push(m); s.revisions.push({ message: newId, version: 1, body, at: now });routeMessage(s,u,id,m.sequence,m.id,parent,attentionPayload,newId,now); return visibleMessage(s,m)
 }
 if (action === 'outcomes') {
  const body = text(input.body), kind = input.kind; if (!['decision','commitment'].includes(kind)) fail(400,'Invalid outcome')
  const assignee = kind === 'commitment' ? text(input.assignee,128) : null
  if (assignee && !c.members.includes(assignee)) fail(400,'Assignee must be a member')
  const deadline = deadlineValue(input.deadline), source = input.source || null
  const sourceMessage = source ? s.messages.find(m => m.id === source && m.conversation === id && !m.deleted) ?? fail(400,'Source must be visible in this conversation') : null
  const o: Outcome = { id: newId, conversation: id, author: u.id, assignee, kind, body, source, source_version: sourceMessage?.version ?? null, version: 1, status: kind === 'decision' ? 'recorded' : 'proposed', deadline }
  s.outcomes.push(o); s.outcome_versions.push({ outcome: newId, version: 1, actor: u.id, body, status: o.status, deadline }); const seq=event(c,'outcome',newId);routeOutcome(s,u,o,seq,newId,now); return o
 }
 if (action === 'read') {
  if (!Number.isSafeInteger(input.seq) || input.seq < 0 || input.seq > c.seq) fail(400,'Invalid read frontier')
  const r = s.reads.find(r => r.user === u.id && r.conversation === id); if (r) r.seq = Math.max(r.seq,input.seq); else s.reads.push({ user: u.id, conversation: id, seq: input.seq }); return {ok:true}
 }
 return fail(404,'Not found')
}
