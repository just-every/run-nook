import {fullMember} from './access'

export const channelManager=(conversationSql:string)=>`(SELECT CASE WHEN ls.conversation IS NULL THEN lc.owner ELSE ls.manager END FROM nook_conversations lc LEFT JOIN nook_channel_settings ls ON ls.conversation=lc.id WHERE lc.id=${conversationSql} AND lc.kind<>'dm' AND EXISTS(SELECT 1 FROM nook_members lm JOIN oa_operators lo ON lo.id=lm.user WHERE lm.conversation=lc.id AND lm.user=CASE WHEN ls.conversation IS NULL THEN lc.owner ELSE ls.manager END AND lo.status='active' AND ${fullMember('lo.id')}))`
export const channelWritable=(conversationSql:string)=>`NOT EXISTS(SELECT 1 FROM nook_channel_settings s WHERE s.conversation=${conversationSql} AND s.archived=1)`
// Callers must also hold current membership via Context's transaction fence.
export const channelManagement=(userSql:string,conversationSql:string)=>`EXISTS(SELECT 1 FROM oa_operators operator WHERE operator.id=${userSql} AND ${fullMember('operator.id')} AND operator.status='active' AND (operator.role IN ('owner','admin') OR operator.id=${channelManager(conversationSql)}))`
export const channelColumns=(alias='c')=>`${alias}.version,${channelManager(alias+'.id')} AS manager,COALESCE((SELECT topic FROM nook_channel_settings WHERE conversation=${alias}.id),'') AS topic,COALESCE((SELECT archived FROM nook_channel_settings WHERE conversation=${alias}.id),0) AS archived`
