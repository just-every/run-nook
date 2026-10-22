import type {SavedItem} from './collection-types'
import type {Reaction} from '../team/types'
import type {notifySettings} from '../notify/preferences'
import type { SlackPresentation } from '../imports/SlackHistory'
export type Person = { id: string; name: string; presenceEnabled?:boolean;typingEnabled?:boolean;zone?:string;status?:{emoji:string;text:string;expiresAt:number|null}|null;active?:number; mode?:'member'|'guest'; role?:'owner'|'admin'|'member' }
export type Conversation = { id: string; name: string; kind: 'channel'|'private'|'dm'; owner: string; section?:string;position?:number;version?:number; manager?:string|null; topic?:string; convertedTo?:string|null;convertedFrom?:string|null;archived?:boolean; canPost?:boolean|number;canReply?:boolean|number; seq: number; readSeq: number; unread: number; participants?: Person[] }
export type FileRecord = { id: string; author: string; name: string; size: number; mime:string; state: 'staged'|'attached'|'deleted' }
export type Message = { nativeContinuation?:boolean; app?:boolean; via?:string; broadcast?:import('../broadcast/BroadcastRecipients').BroadcastSummary|null; id: string; conversation: string; author: string|null; authorName: string; retainedSource?:'native'|'imported';immutable?:boolean; slack?:SlackPresentation; provenance?:{timestamp:string;label:string}; body: string; parent: string|null; version: number; deleted: number; created: string; sequence: number; attachments: FileRecord[]; replyCount?:number; reactions?:Reaction[]; notified?:{id:string;name:string}[]; adminOverride?:boolean;urgent?:boolean; urgentReason?:string|null }
export type Outcome = { id: string; conversation: string; erased?:boolean; author: string|null; authorName: string|null; assignee: string|null; assigneeName: string|null; kind: 'decision'|'commitment'; body: string; source: string|null; sourceState: string; version: number; status: string; deadline: string|null }
export type FollowSource = 'explicit'|'authored'|'replied'|'mentioned'|'dm'|'all'
export type Preferences = { muted: boolean; followed: boolean; threads: string[]; threadFollows?:{message:string;source:FollowSource}[] }
export type AttentionItem = { explanation?:string; id: string; conversation: string; reason: string; state:string; created:string; message: {id:string;body:string;author:string;deleted:number;parent:string|null;urgentReason:string|null;authorName?:string}|null; outcome: Outcome|null }
export type Attention = { heldItems?:{id:string;conversation:string;explanation:string}[];scheduleUntil?:number;manualUntil?:number; personalReminders?:{id:string;version:number;text:string;zone:string;next_due:number;conversation:string|null;source:string|null;source_kind:string|null}[]; items: AttentionItem[];reminders?:{items:SavedItem[];hasMore:boolean}; deferredCount: number; observedAt:number; dndUntil: number|null; nextWakeAt: number|null }
export type Replay = { events: {seq:number;kind:string;object:string}[]; cursor: number; frontier: number; hasMore: boolean }
export type Screen = 'people'|'files'|'drafts'|'chat'|'reminders'|'scheduled'|'unreads'|'attention'|'threads'|'channels'|'search'|'you'|'team'|'saved'
export type LocationState = { view: Screen; conversation: string|null; thread: string|null; focus: string|null; panel: 'outcomes'|'notes'|null; before: string|null; threadBefore: string|null; q: string; landing: boolean }
export type MessageWindow = {items:Message[];root:Message|null;target:{id:string;parent:string|null;root:string}|null;cursor:string|null;freezeCursor?:string|null;hasMore:boolean;hasNewer:boolean;readSeq:number;threadReadSeq?:number;threadReadThrough?:number;readBarrierSeq:number|null;readThrough:number;frontier:number}
export type Projection = { key:string; conversation: string; rootWindow:MessageWindow; threadWindow:MessageWindow|null; outcomes: Outcome[]; members: Person[]; roster:Person[]; preferences: Preferences; frontier: number; newMessageCount:number }
// Local development uses key-gated personas and silently suppresses default mail.
export type InitialWorkspace = {user: Person; conversations: Conversation[]; route?:LocationState; snapshot?:WorkspaceSnapshot; localDevelopment?: boolean}
export type DialogState = {kind:'reminder';phrase?:string;source?:string;sourceKind?:'message'|'attachment';onSaved?:()=>void}|{kind:'new-message'}|{kind:'new-channel'}|{kind:'details'}|{kind:'pins'}|{kind:'notifications'}|{kind:'schedule';draft?:{body:string;parent:string|null;mentions:string[];urgent:boolean;urgentReason:string|null;files:FileRecord[]};onScheduled?:()=>void}|{kind:'edit';message:Message}|{kind:'delete';message:Message}|{kind:'outcome';source:string|null;outcomeKind:'decision'|'commitment'}|{kind:'revise';outcome:Outcome}

export type Page<T> = {items:T[];cursor:string;hasMore:boolean}

export type WorkspaceSnapshot={channelPage?:{items:{id:string;name:string}[];cursor:string|null}|null;signature:string;dataError?:{status:number;message:string}|null;user:Person;conversations:Conversation[];users:Person[];attention:Attention;data:Projection|null;notify:Awaited<ReturnType<typeof notifySettings>>;pushSync:{active:string[];badge:number}}

export type ReadAcknowledgement={user:string;conversation:string;conversations:Conversation[];pushSync:WorkspaceSnapshot['pushSync']}
