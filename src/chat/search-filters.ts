export type SearchFilters={conversation:string;person:string;afterDate:string;beforeDate:string;conversationType:string}
export const emptyFilters:SearchFilters={conversation:'',person:'',afterDate:'',beforeDate:'',conversationType:''}
export function filterQuery(text:string,filters:SearchFilters){
 const existing=queryParts(text).filter(part=>!(filters.conversation&&/^in:/i.test(part)||filters.person&&/^from:/i.test(part)||filters.afterDate&&/^(after|on):/i.test(part)||filters.beforeDate&&/^(before|on):/i.test(part)||filters.conversationType&&/^type:/i.test(part))).join(' ')
 return [existing,filters.conversation&&`in:#${filters.conversation}`,filters.person&&`from:@${filters.person}`,filters.afterDate&&`after:${filters.afterDate}`,filters.beforeDate&&`before:${filters.beforeDate}`,filters.conversationType&&`type:${filters.conversationType}`].filter(Boolean).join(' ')
}
export function queryParts(query:string):string[]{
 const parts:string[]=[];let part='',quoted=false
 for(const character of query){if(character==='"')quoted=!quoted;if(/\s/u.test(character)&&!quoted){if(part)parts.push(part);part=''}else part+=character}
 if(part)parts.push(part);return parts
}
export const isModifier=(value:string)=>/^"[\s\S]*"$|^-\S/.test(value)||/^(from:|in:|with:|to:me$|type:|has:(?:file|link|pin|:[^:]+:)$|is:(?:saved|thread)$|before:|after:|on:|during:)/i.test(value)
