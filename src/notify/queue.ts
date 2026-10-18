import {emailBroadcastChoice} from '../broadcast/policy'
import {conversationLevel} from '../team/conversation-notify.server'
import type {Context} from '../platform/storage/context'
// C14 delivery timing. A new item waits a few seconds so a burst folds into one
// email; one email per recipient per conversation per FOLD_MS; failed sends retry
// on RETRY_MS and become "not delivered" (failed) after the last attempt.
export const GATHER_MS=5_000,FOLD_MS=10*60_000,LEASE_MS=60_000,KEEP_MS=30*86400_000
export const RETRY_MS=[15_000,60_000,5*60_000,30*60_000,2*3600_000]
export const MAX_ATTEMPTS=RETRY_MS.length+1
export const reasons=['broadcast','mention','urgent-request','commitment-proposal','commitment-revision','commitment-complete'] as const
export type Reason=typeof reasons[number]
export type ErrorClass='not-set-up'|'refused'|'rate-limited'|'uncertain'
/** The state after a failed attempt: retry on the schedule, or give up visibly. */
export function afterFailure(attempts:number,retryable:boolean,now:number){return retryable&&attempts<MAX_ATTEMPTS?{state:'retrying' as const,due:now+RETRY_MS[attempts-1]}:{state:'failed' as const,due:now}}
/** When the next email for a recipient and conversation may go, given the last one sent. */
export function foldedUntil(lastSent:number|null,now:number){return lastSent!==null&&now<lastSent+FOLD_MS?lastSent+FOLD_MS:null}
const columns='id,dedupe,user,conversation,actor,message,outcome,reason,due,created,updated'
// Written in the same batch as Attention: mentions, broadcasts and urgent
// requests for recipients who turned the matching email on. Attention IDs
// for a message are MESSAGE.USER, so the range selects exactly this message's rows.
export function enqueueMessage(c:Pick<Context,'uid'|'sql'>,message:string,now:number){return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(${columns}) SELECT a.id,a.id,a.user,a.conversation,?,a.message,NULL,a.reason,?,?,? FROM nook_attention a JOIN nook_notify_preferences p ON p.user=a.user WHERE a.id>? AND a.id<? AND a.message=? AND ${conversationLevel('a.user','a.conversation')}<>'nothing' AND (a.reason='broadcast' AND ${emailBroadcastChoice('a.user')}=1 OR a.reason='mention' AND p.mentions=1 OR a.reason='urgent-request' AND p.urgent=1)`,c.uid,now+GATHER_MS,now,now,message+'.',message+'/',message)}
// Commitment attention IDs are OUTCOME.VERSION.USER: a proposal or material
// revision to the assignee, or a completion report to the author.
export function enqueueOutcome(c:Context,outcome:string,version:number,now:number){const prefix=`${outcome}.${version}`;return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(${columns}) SELECT a.id,a.id,a.user,a.conversation,?,NULL,o.id,CASE WHEN o.status='reported-complete' THEN 'commitment-complete' WHEN o.version=1 THEN 'commitment-proposal' ELSE 'commitment-revision' END,?,?,? FROM nook_attention a JOIN nook_outcomes o ON o.id=a.outcome JOIN nook_notify_preferences p ON p.user=a.user AND p.mentions=1 WHERE a.id>? AND a.id<? AND o.id=? AND o.status IN ('proposed','reported-complete') AND ${conversationLevel('a.user','a.conversation')}<>'nothing'`,c.uid,now+GATHER_MS,now,now,prefix+'.',prefix+'/',outcome)}
