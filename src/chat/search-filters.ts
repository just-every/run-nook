export type SearchFilters={conversation:string;person:string;afterDate:string;beforeDate:string}
export const emptyFilters:SearchFilters={conversation:'',person:'',afterDate:'',beforeDate:''}
export function filterQuery(text:string,filters:SearchFilters){
 const existing=queryParts(text).filter(part=>!(filters.conversation&&/^in:/i.test(part)||filters.person&&/^from:/i.test(part)||filters.afterDate&&/^(after|on):/i.test(part)||filters.beforeDate&&/^(before|on):/i.test(part))).join(' ')
 return [existing,filters.conversation&&`in:#${filters.conversation}`,filters.person&&`from:@${filters.person}`,filters.afterDate&&`after:${filters.afterDate}`,filters.beforeDate&&`before:${filters.beforeDate}`].filter(Boolean).join(' ')
}
export function queryParts(query:string):string[]{return query.match(/(?:[^\s"]+|"[^"]*")+/g)??[]}
export const isModifier=(value:string)=>/^(from:|in:|has:(?:file|pin)$|is:saved$|before:|after:|on:)/i.test(value)
