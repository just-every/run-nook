import type { SlackPresentation } from '../imports/SlackHistory'
export type Person = { id: string; name: string; active?:number; mode?:'member'|'guest'; role?:'owner'|'admin'|'member' }
export type Conversation = { id: string; name: string; kind: 'channel'|'private'|'dm'; owner: string; seq: number; readSeq: number; unread: number; participants?: Person[] }
export type FileRecord = { id: string; author: string; name: string; size: number; mime:string; state: 'staged'|'attached'|'deleted' }
export type Message = { id: string; conversation: string; author: string|null; authorName: string; retainedSource?:'native'|'imported';immutable?:boolean; slack?:SlackPresentation; provenance?:{timestamp:string;label:string}; body: string; parent: string|null; version: number; deleted: number; created: string; sequence: number; attachments: FileRecord[] }
export type Outcome = { id: string; conversation: string; erased?:boolean; author: string|null; authorName: string|null; assignee: string|null; assigneeName: string|null; kind: 'decision'|'commitment'; body: string; source: string|null; sourceState: string; version: number; status: string; deadline: string|null }
export type Preferences = { muted: boolean; followed: boolean; threads: string[] }
export type AttentionItem = { id: string; conversation: string; reason: string; state:string; created:string; message: {id:string;body:string;author:string;deleted:number;parent:string|null;urgentReason:string|null;authorName?:string}|null; outcome: Outcome|null }
export type Attention = { items: AttentionItem[]; deferredCount: number; observedAt:number; dndUntil: number|null; nextWakeAt: number|null }
export type Replay = { events: {seq:number;kind:string;object:string}[]; cursor: number; frontier: number; hasMore: boolean }
export type Screen = 'chat'|'attention'|'channels'|'search'|'you'|'team'
export type LocationState = { view: Screen; conversation: string|null; thread: string|null; focus: string|null; panel: 'outcomes'|null; before: string|null; threadBefore: string|null; q: string; landing: boolean }
export type MessageWindow = {items:Message[];root:Message|null;target:{id:string;parent:string|null;root:string}|null;cursor:string|null;freezeCursor?:string|null;hasMore:boolean;hasNewer:boolean;readSeq:number;readBarrierSeq:number|null;readThrough:number;frontier:number}
export type Projection = { key:string; conversation: string; rootWindow:MessageWindow; threadWindow:MessageWindow|null; outcomes: Outcome[]; members: Person[]; roster:Person[]; preferences: Preferences; frontier: number; newMessageCount:number }
// developmentOutbox: invitations go to the local development outbox (local mail only).
export type InitialWorkspace = {user: Person; conversations: Conversation[]; developmentOutbox?: boolean}
export type DialogState = {kind:'new-message'}|{kind:'new-channel'}|{kind:'details'}|{kind:'edit';message:Message}|{kind:'delete';message:Message}|{kind:'outcome';source:string|null;outcomeKind:'decision'|'commitment'}|{kind:'revise';outcome:Outcome}

export type Page<T> = {items:T[];cursor:string;hasMore:boolean}
