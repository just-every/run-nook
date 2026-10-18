import type {Recurrence} from '../scheduled/time.mjs'

export type ReminderPreview = {
 broadcast?:import('../broadcast/ConfirmBroadcast').BroadcastPreview|null
 target:string
 text:string
 localAt:string
 zone:string
 recurrence:Recurrence
 endDate:null
 due:number
 recipient:string
 conversation:string|null
 audience:string
}

export type Reminder = {
 id:string
 ownerName?:string
 recipientName?:string
 user:string
 recipient:string
 conversation:string|null
 name:string|null
 source:string|null
 source_kind:'message'|'attachment'|null
 text:string
 local_at:string
 zone:string
 recurrence:Recurrence
 next_due:number
 state:string
 version:number
 reason:string|null
 schedule:string|null
 delivery:'pending'|'delivered'|'held'|'failed'|'done'|'cancelled'
 unavailable:boolean
}

export type ReminderPage = {items:Reminder[];cursor:string;hasMore:boolean}
