import {useEffect,useRef,useState} from 'react'

type Conversion={source:string;converted:string}
const preferenceKey=(user:string)=>`nook:composition:v1:${encodeURIComponent(window.location.origin)}:${encodeURIComponent(user)}`
export function useFormatting(user:string){
 const [enabled,setEnabled]=useState(true),[literal,setLiteral]=useState(false),[canUndo,setCanUndo]=useState(false),[error,setError]=useState('')
 const undo=useRef<Conversion|null>(null)
 useEffect(()=>{try{setEnabled(localStorage.getItem(preferenceKey(user))!=='off');setError('')}catch{setError('Formatting preference could not be read.')}undo.current=null;setLiteral(false);setCanUndo(false)},[user])
 function toggle(value:boolean){try{localStorage.setItem(preferenceKey(user),value?'on':'off');setEnabled(value);setLiteral(!value);setError('')}catch{setError('Formatting preference could not be saved.')}}
 function change(source:string,previous:string,caret:number){
  setLiteral(!enabled);undo.current=null;setCanUndo(false)
  if(!enabled||source.length!==previous.length+1)return source
  const before=source.slice(0,caret),after=source.slice(caret)
  // A matched delimiter converts once, at the insertion point. Pasted text is
  // kept verbatim; its preview still uses the same safe Markdown representation.
  let converted=before
  if(!/```[^]*$/.test(before.replace(/```[^]*?```/g,''))){
   converted=before.replace(/(^|[\s(])\*([^*\n]+)\*$/, '$1**$2**').replace(/(^|[\s(])_([^_\n]+)_$/, '$1*$2*').replace(/(^|[\s(])~([^~\n]+)~$/, '$1~~$2~~')
  }
  const block=/(?:^|\n)(?:> |[-+] |\d+\. |```[^\n]*\n)$/.test(before),code=/(?:^|\s)`[^`\n]+`$/.test(before),fence=/```\s*$/.test(before)&&before.indexOf('```')!==before.lastIndexOf('```')
  converted+=after
  if(converted!==source||block||code||fence){undo.current={source,converted};setCanUndo(true)}
  return converted
 }
 function restore(current:string){const last=undo.current;if(!last||last.converted!==current)return null;undo.current=null;setCanUndo(false);setLiteral(true);return last.source}
 return {enabled,literal,canUndo,error,toggle,change,restore,showFormatted:()=>{setLiteral(false);undo.current=null;setCanUndo(false)}}
}
