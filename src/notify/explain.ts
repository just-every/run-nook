import {deliveryError} from './delivery-words'
import {conversationLevel} from '../team/conversation-notify.server'
/** Body-free explanations describe the recorded effect first. Provider acceptance
 * is delivery to the provider, never a claim of observed device display. */
export function explainDelivery(row:any,quietUntil:number,manualUntil:number,now=Date.now()){
 if(['sent','folded'].includes(row.state))return 'Delivered to the provider'+(row.state==='folded'?' in a gathered alert':'')
 if(row.error==='held-active-elsewhere')return 'Held while active elsewhere; cancelled after you read or dismissed it'
 if(['conversation-silent','turned-off','muted','broadcast-suppressed','unfollowed'].includes(row.error))return 'Suppressed by your level or notification choices'
 if(row.state==='cancelled')return 'Cancelled: '+deliveryError(row.error)
 if(row.state==='failed')return row.error==='uncertain'?'Provider outcome uncertain':'Delivery failed: '+(row.error?deliveryError(row.error):'unconfirmed')
 if(row.snoozeUntil>now&&row.snoozeUntil>=Math.max(quietUntil,manualUntil))return 'Held until '+new Date(row.snoozeUntil).toISOString()+' by your item snooze'
 if(quietUntil>now&&!(row.reason==='urgent-request'&&row.quietBypass===1))return 'Held until '+new Date(quietUntil).toISOString()+' by your quiet schedule'
 if(manualUntil>now&&!(row.reason==='urgent-request'&&row.quietBypass===1))return 'Held until '+new Date(manualUntil).toISOString()+' by your quiet snooze'
 if(row.heldAt&&row.releasedAt==null)return 'Held active-elsewhere or waiting for your mobile delay'
 if(row.state==='sending')return 'Awaiting provider confirmation'
 return row.state==='retrying'?'Waiting for a provider retry':'Gathering before delivery'
}
export const attentionLevel=(user:string,conversation:string)=>conversationLevel(user,conversation)
