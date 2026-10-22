export const MAX_CUES=500;
export const MAX_TRANSCRIPT_CHARS=100000;
export const MAX_CLIP_SECONDS=86400;
const invalid=message=>{throw Error(message)};

/** Seconds, with millisecond precision. Cue text is always inert human text. */
export function validateCues(value){
 if(!Array.isArray(value)||value.length>MAX_CUES)invalid('Use at most 500 timestamped cues.');
 let total=0,previous=-1;
 return value.map(cue=>{
  if(!cue||typeof cue!=='object'||Array.isArray(cue)||Object.keys(cue).sort().join()!=='end,start,text')invalid('Each cue needs start, end and text.');
  const {start,end,text}=cue;
  if(typeof start!=='number'||typeof end!=='number'||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>MAX_CLIP_SECONDS||start<previous||Math.abs(start*1000-Math.round(start*1000))>0.00001||Math.abs(end*1000-Math.round(end*1000))>0.00001)invalid('Cues need ordered start times and later end times, within 24 hours.');
  if(typeof text!=='string'||!text.trim()||text.length>4000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)||/\n\s*\n/.test(text))invalid('Each cue needs 1–4000 characters of plain text without blank lines.');
  total+=text.length;if(total>MAX_TRANSCRIPT_CHARS)invalid('Transcript text exceeds 100,000 characters.');
  previous=start;return {start,end,text};
 });
}
export function timestamp(seconds){
 const ms=Math.round(seconds*1000),hours=Math.floor(ms/3600000),minutes=Math.floor(ms/60000)%60,whole=Math.floor(ms/1000)%60;
 return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(whole).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
function seconds(value){
 const match=/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
 if(!match)invalid('Use WebVTT timestamps such as 00:01.000 or 00:00:01.000.');
 return Number(match[1]??0)*3600+Number(match[2])*60+Number(match[3])+Number(match[4])/1000;
}
/** A deliberately plain WebVTT subset: cue IDs/settings are accepted; NOTE
 * blocks are ignored. STYLE, REGION and active caption markup are refused. */
export function parseWebVTT(value,{header=true}={}){
 if(typeof value!=='string'||value.length>MAX_TRANSCRIPT_CHARS+40000)invalid('Caption input exceeds 140,000 characters.');
 const source=value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 let body=source,uploaded=header;
 if(/^WEBVTT(?:[ \t][^\n]*)?(?:\n|$)/.test(source)){
  uploaded=true;
  const end=source.indexOf('\n\n');
  if(end<0){if(source.trim()==='WEBVTT')return [];invalid('Put a blank line after the WEBVTT header.');}
  const meta=source.slice(0,end).split('\n');
  if(meta.length!==1)invalid('WebVTT header metadata is not supported.');
  body=source.slice(end+2);
 }else if(header)invalid('Caption files must begin with WEBVTT.');
 const cues=[];
 for(const block of body.split(/\n[ \t]*\n/)){
  if(!block.trim())continue;
  const lines=block.replace(/^\n+|\n+$/g,'').split('\n');
  if(/^NOTE(?:[ \t]|$)/.test(lines[0]))continue;
  if(/^(STYLE|REGION)(?:[ \t]|$)/.test(lines[0]))invalid('Use plain WebVTT cues without STYLE or REGION blocks.');
  if(!lines[0].includes('-->'))lines.shift();
  const timing=/^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+[^\n]*)?$/.exec(lines.shift()??'');
  if(!timing||!lines.length)invalid('Each cue needs a timestamp line and caption text.');
  const text=lines.join('\n');
  if(uploaded&&/<[^>]*>/.test(text))invalid('Use plain caption text without WebVTT markup.');
  const decoded=uploaded?text.replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',nbsp:'\u00a0',lrm:'\u200e',rlm:'\u200f'}[name])):text;
  cues.push({start:seconds(timing[1]),end:seconds(timing[2]),text:decoded});
 }
 return validateCues(cues);
}
export function cuesWebVTT(cues){
 const plain=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return 'WEBVTT\n\n'+validateCues(cues).map((cue,i)=>`${i+1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${plain(cue.text)}\n`).join('\n');
}
/** Editor text preserves literal text; caption output separately escapes it. */
export function cuesEditorText(cues){return validateCues(cues).map(cue=>`${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}`).join('\n\n');}
