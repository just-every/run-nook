import {broadcastRecipient} from '../../broadcast/audience'
// A counting choice does not move a read cursor, hide Threads, or cancel alerts.
// Use the committed routing payload/audience, never a display-text match.
export const threadBadgeChoice=(user:string)=>`COALESCE((SELECT thread_badge FROM nook_notify_preferences WHERE user=${user}),'all')`
export const countedMessage=(user:string,m='m')=>`(${m}.parent IS NULL OR ${threadBadgeChoice(user)}='all' OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(${m}.payload) THEN ${m}.payload ELSE '{}' END,'$.mentions') j WHERE j.value=${user}) OR ${broadcastRecipient(m+'.id',user)})`
