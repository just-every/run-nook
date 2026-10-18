import type {SavedReminderState} from './SavedReminder'
export type CollectionMessage={id:string;body:string;parent:string|null;created:string;author:string|null;authorName:string|null;source:'native'|'imported'}
type SavedBase={id:string;created:string;reminder?:SavedReminderState|null}
type AvailableSource={unavailable:false;conversation:string;conversationName:string;conversationKind:'channel'|'private'|'dm'}
export type SavedItem=SavedBase&(
 |{unavailable:true;kind:'message'|'attachment'|'link'}
 |AvailableSource&{kind:'message';message:CollectionMessage}
 |AvailableSource&{kind:'attachment';attachment:{id:string;name:string;mime:string;size:number;message:string;created:string}}
 |AvailableSource&{kind:'link';url:string}
)
export type PinnedItem=Extract<SavedItem,{kind:'message'}|{unavailable:true}>&{pinnedBy:{id:string;name:string}|null}
export type CollectionPage<T>={items:T[];cursor:string|null}
