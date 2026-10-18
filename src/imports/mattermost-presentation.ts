import type {Context} from '../platform/storage/context'
import type {SlackPresentation} from './SlackHistory'
export async function mattermostPresentation(c:Context,row:any,source:any):Promise<SlackPresentation>{
 const users=[...new Set<string>((source.reactions??[]).map((r:any)=>r.user))]
 const actors=users.length?await c.rows('SELECT source_id,source_record FROM nook_import_actors WHERE job=? AND source_id IN (SELECT value FROM json_each(?))',[row.job,JSON.stringify(users)],row.conversation):[]
 const names=new Map(actors.map(a=>[a.source_id,JSON.parse(a.source_record).name??a.source_id]))
 const grouped=new Map<string,string[]>()
 for(const reaction of source.reactions??[]){const people=grouped.get(reaction.emoji_name)??[];people.push(names.get(reaction.user)??reaction.user);grouped.set(reaction.emoji_name,people)}
 return {source:'Mattermost',pinned:source.is_pinned,text:row.body,edited:source.updated_at!==source.created_at,missingFiles:[],reactions:[...grouped].map(([name,people])=>({name,count:people.length,people,image:source.customEmojiNames?.includes(name)?`/api/mattermost-emoji/${row.conversation}/${encodeURIComponent(name)}`:undefined}))}
}
