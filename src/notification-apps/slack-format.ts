// Slack's incoming-webhook payload mapped to the Markdown Nook renders. Only the
// supported subset is rendered; anything else falls back to the text and says so.
// Nothing here fetches a URL: images, icons and unfurls are never loaded.
export const UNSUPPORTED_NOTICE='This message used formatting Nook does not support.'
type Json=Record<string,unknown>
const object=(value:unknown):value is Json=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const string=(value:unknown)=>typeof value==='string'?value:''
/** mrkdwn links, bold and strike-through; everything else is already Markdown-compatible. */
export function mrkdwn(value:string){
 return value
  .replace(/<(https?:\/\/[^|>\s]+)\|([^>]+)>/g,(_,url,label)=>`[${label}](${url})`)
  .replace(/<(https?:\/\/[^>\s]+)>/g,'$1')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g,'$1**$2**')
  .replace(/(^|[\s(])~([^~\n]+)~(?=[\s).,!?:;]|$)/g,'$1~~$2~~')
}
function blockText(value:unknown){return object(value)&&typeof value.text==='string'?mrkdwn(value.text):null}
export function formatSlackPayload(payload:Json){
 const lines:string[]=[];let unsupported=false
 if(typeof payload.text==='string'&&payload.text.trim())lines.push(mrkdwn(payload.text))
 for(const block of Array.isArray(payload.blocks)?payload.blocks:[]){
  if(!object(block)){unsupported=true;continue}
  if(block.type==='divider'){lines.push('---');continue}
  if(block.type==='header'){const text=blockText(block.text);if(text)lines.push('## '+text);else unsupported=true;continue}
  if(block.type==='section'){
   const text=blockText(block.text),fields=Array.isArray(block.fields)?block.fields.map(blockText):[]
   if((block.text!==undefined&&text===null)||fields.some(f=>f===null)||block.accessory!==undefined||(text===null&&!fields.length)){unsupported=true;continue}
   if(text)lines.push(text);for(const field of fields as string[])lines.push(field);continue
  }
  if(block.type==='context'&&Array.isArray(block.elements)){
   const parts=block.elements.map(element=>object(element)&&element.type!=='image'?blockText(element):null)
   if(parts.some(p=>p===null))unsupported=true
   const shown=parts.filter((p):p is string=>p!==null);if(shown.length)lines.push(shown.join(' · '));continue
  }
  unsupported=true
 }
 for(const attachment of Array.isArray(payload.attachments)?payload.attachments:[]){
  if(!object(attachment)){unsupported=true;continue}
  const known=new Set(['title','text','fallback','fields','color','mrkdwn_in','ts','footer'])
  if(Object.keys(attachment).some(key=>!known.has(key)))unsupported=true
  if(string(attachment.title))lines.push('**'+mrkdwn(string(attachment.title))+'**')
  if(string(attachment.text))lines.push(mrkdwn(string(attachment.text)))
  else if(string(attachment.fallback)&&!string(attachment.title))lines.push(mrkdwn(string(attachment.fallback)))
  for(const field of Array.isArray(attachment.fields)?attachment.fields:[])if(object(field)&&string(field.value))lines.push((string(field.title)?mrkdwn(string(field.title))+': ':'')+mrkdwn(string(field.value)));else unsupported=true
 }
 return {text:lines.join('\n\n'),unsupported}
}
