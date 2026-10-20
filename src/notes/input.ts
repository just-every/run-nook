import {fail,text} from '../family/team-chat/domain'
export type NoteItem={id:string;text:string;checked:boolean}
export type NoteLink={url:string;label:string}
export type NoteContent={title:string;body:string;items:NoteItem[];links:NoteLink[];pinned:boolean}
export function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Expected a JSON object')
 return value as Record<string,unknown>
}
export function exact(value:unknown,required:string[],optional:string[]=[]){
 const input=object(value)
 if(required.some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>![...required,...optional].includes(k)))fail(400,'Unexpected or missing note fields')
 return input
}
export function noteId(value:unknown):string{
 if(typeof value!=='string'||!value.length||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))fail(400,'Invalid note ID')
 return value as string
}
export function version(value:unknown):number{
 if(!Number.isSafeInteger(value)||Number(value)<1)fail(400,'Invalid note version')
 return value as number
}
export function linkUrl(value:unknown):string{
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))fail(400,'Invalid document URL')
 let url:URL;try{url=new URL(value as string)}catch{fail(400,'Invalid document URL')}
 if(!['https:','http:'].includes(url!.protocol)||url!.username||url!.password||!url!.hostname||url!.href.length>2048)fail(400,'Use an HTTP or HTTPS document link without credentials')
 return url!.href
}
export function content(value:unknown):NoteContent{
 const input=exact(value,['title','body','items','links','pinned'])
 if(typeof input.body!=='string'||input.body.length>8000||typeof input.pinned!=='boolean')fail(400,'Invalid note content')
 if(!Array.isArray(input.items)||input.items.length>50||!Array.isArray(input.links)||input.links.length>10)fail(400,'Use at most 50 checklist items and 10 document links')
 const items=(input.items as unknown[]).map(value=>{const item=exact(value,['id','text','checked']);if(typeof item.checked!=='boolean')fail(400,'Invalid checklist state');return {id:noteId(item.id),text:text(item.text,500),checked:item.checked as boolean}})
 if(new Set(items.map(i=>i.id)).size!==items.length)fail(400,'Checklist item IDs must be unique')
 const links=(input.links as unknown[]).map(value=>{const link=exact(value,['url','label']);return {url:linkUrl(link.url),label:text(link.label,200)}})
 return {title:text(input.title,200),body:input.body as string,items,links,pinned:input.pinned as boolean}
}
