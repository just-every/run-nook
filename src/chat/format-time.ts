/** One list timestamp, interpreted in the record's zone when it has one. */
export function formatTime(value:string|number|Date,{timeZone}:{timeZone?:string}={}){
 return new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',...(timeZone?{timeZone}:{})}).format(new Date(value))
}
/** Explanations retain their reason while timestamps use the same list style. */
export const formatTimeText=(text:string)=>text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,stamp=>formatTime(stamp))
