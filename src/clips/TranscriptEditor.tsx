import {useId,useState} from 'react'
import {cuesEditorText,parseWebVTT,type ClipCue} from './cues.mjs'
export type TranscriptInput={language:string;cues:ClipCue[]}|{language:string;vtt:string}
type Props={cues:ClipCue[];language:string;busy:boolean;onSave:(input:TranscriptInput)=>Promise<void>;onCancel:()=>void}
/** Native human text only. Reading a caption file is local; saving appends one
 * immutable server version through the clip's current source audience. */
export function TranscriptEditor({cues,language:initialLanguage,busy,onSave,onCancel}:Props){
 const [text,setText]=useState(()=>cuesEditorText(cues)),[vtt,setVtt]=useState<string|null>(null),[language,setLanguage]=useState(initialLanguage),[error,setError]=useState(''),[reading,setReading]=useState(false)
 const id=useId()
 async function captionFile(file:File){
  setReading(true);setError('')
  try{
   if(file.size<1||file.size>560000)throw Error('Choose a UTF-8 WebVTT file up to 560,000 bytes.')
   const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()),parsed=parseWebVTT(content)
   setText(cuesEditorText(parsed));setVtt(content)
  }catch(error){setError(error instanceof Error?error.message:'Caption file could not be read. Try again.')}
  finally{setReading(false)}
 }
 async function save(){
  setError('')
  try{await onSave(vtt===null?{language,cues:parseWebVTT(text,{header:false})}:{language,vtt})}
  catch(error){setError(error instanceof Error?error.message:'Transcript could not be saved. Retry or reload the current version.')}
 }
 return <div className="clip-editor"><fieldset disabled={busy||reading}>
  <label htmlFor={id+'-cues'}>Timestamped transcript</label><p className="clip-meta">Use a timestamp range, followed by text. Put a blank line between cues. Up to 500 cues, 100,000 text characters and timestamps within 24 hours. Saving keeps every previous version.</p>
  <textarea id={id+'-cues'} rows={8} maxLength={140000} spellCheck value={text} placeholder={'00:00.000 --> 00:03.000\nOpening words\n\n00:03.000 --> 00:06.000\nNext words'} onChange={e=>{setText(e.target.value);setVtt(null)}}/>
  <label htmlFor={id+'-language'}>Caption language</label><input id={id+'-language'} maxLength={35} value={language} placeholder="en" onChange={e=>setLanguage(e.target.value)}/>
  <label htmlFor={id+'-vtt'}>Or upload a plain WebVTT caption file</label><input id={id+'-vtt'} type="file" accept=".vtt,text/vtt" onChange={e=>{const file=e.target.files?.[0];if(file)void captionFile(file);e.target.value=''}}/>
  <p className="clip-meta">Plain cue text only. Cue identifiers and settings are accepted; NOTE blocks are ignored. STYLE, REGION and caption markup are unsupported.</p>
  <div className="clip-toolbar"><button type="button" className="soft-button" onClick={()=>void save()}>{busy?'Saving…':'Save new transcript version'}</button><button type="button" className="text-button" onClick={onCancel}>Cancel</button></div>
 </fieldset>{error&&<p className="warning" role="alert">{error}</p>}</div>
}
