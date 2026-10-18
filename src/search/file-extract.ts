import {getDocumentProxy} from 'unpdf'

// Files outside these extraction limits remain searchable by filename and are
// reported as unindexed. Text is never silently truncated into a complete index.
export const fileExtractionLimits={bytes:25*1024*1024,pages:100,characters:1024*1024} as const

export async function extractFileText(bytes:Uint8Array,mime:string):Promise<string|null>{
 if(mime==='text/plain'){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  return text.includes('\0')||text.length>fileExtractionLimits.characters?null:text
 }
 if(mime!=='application/pdf'||![37,80,68,70,45].every((value,index)=>bytes[index]===value))return null
 // unpdf's bundled PDF.js runs without a separate worker or native canvas.
 // Only embedded data is read: no document URLs, remote fonts, WASM or scripts.
 const pdf=await getDocumentProxy(bytes,{
  useWasm:false,useWorkerFetch:false,
  useSystemFonts:false,disableFontFace:true,disableAutoFetch:true,
  stopAtErrors:true,maxImageSize:16_777_216,verbosity:0,
 })
 try{
  if(pdf.numPages>fileExtractionLimits.pages)return null
  const pages:string[]=[]
  let length=0
  for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number)
   try{
    const content=await page.getTextContent(),parts:string[]=[]
    for(const item of content.items){
     if(!('str' in item))continue
     length+=item.str.length+1
     if(length>fileExtractionLimits.characters)return null
     parts.push(item.str+(item.hasEOL?'\n':' '))
    }
    pages.push(parts.join(''))
   }finally{page.cleanup()}
  }
  const text=pages.join('\n').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
  // Image-only/scanned documents require OCR, which is not available here.
  return text||null
 }finally{await pdf.loadingTask.destroy()}
}
