import {MESSAGE_LIMIT} from '../../family/team-chat/domain'
import type {Draft,Intent,SendPlan} from '../drafts'

export function messageIntent(draft:Draft,parent:string|null,override:boolean):Intent{
 return {body:draft.body,intent:crypto.randomUUID(),parent,attachments:draft.files.map(f=>f.id),mentions:[...new Set([...(draft.mentionIds??[]),...(draft.recipient?[draft.recipient]:[])])],urgent:draft.urgent,urgentReason:draft.urgent?draft.reason:null,...(override?{adminOverride:true as const}:{})}
}
// Slice source verbatim, including newlines, while never bisecting a Unicode
// surrogate pair. Prefer paragraph/word boundaries without dropping separators.
export function splitText(body:string,limit=MESSAGE_LIMIT):string[]{
 const parts:string[]=[];let offset=0
 while(offset<body.length){
  let end=Math.min(offset+limit,body.length)
  if(end<body.length){
   const paragraph=body.lastIndexOf('\n',end-1),space=body.lastIndexOf(' ',end-1),boundary=Math.max(paragraph,space)
   if(boundary>offset+Math.floor(limit*.75))end=boundary+1
   if(/[\uD800-\uDBFF]/.test(body[end-1])&&/[\uDC00-\uDFFF]/.test(body[end]))end--
  }
  parts.push(body.slice(offset,end));offset=end
 }
 return parts
}
export function longMessagePlan(draft:Draft,parent:string|null,override:boolean,kind:'split'|'snippet'):SendPlan{
 const base=messageIntent(draft,parent,override)
 if(kind==='snippet')return {kind,next:0,parts:[{...base,body:`Text snippet · ${draft.body.length.toLocaleString()} characters\n\nThe complete text is attached as snippet.txt.`}],snippet:{intent:crypto.randomUUID(),name:'snippet.txt',file:null}}
 const chunks=splitText(draft.body)
 if(chunks.some(chunk=>!chunk.trim()))throw Error('This text contains a blank section too long for a message. Post it as a snippet to keep every character.')
 return {kind,next:0,parts:chunks.map((body,index)=>({...base,body,intent:crypto.randomUUID(),attachments:index===0?base.attachments:[],mentions:index===0?base.mentions:[],urgent:index===0&&base.urgent,urgentReason:index===0?base.urgentReason:null}))}
}
export function snippetFile(draft:Draft):File{
 return new File([draft.body],draft.plan?.snippet?.name??'snippet.txt',{type:'text/plain'})
}
