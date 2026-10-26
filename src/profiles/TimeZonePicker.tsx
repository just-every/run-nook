export const browserTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone

type Props={value:string;onChange:(zone:string)=>void;'aria-label'?:string;disabled?:boolean}
export function TimeZonePicker({value,onChange,'aria-label':label,disabled}:Props){
 const zones=[...new Set([browserTimeZone(),...Intl.supportedValuesOf('timeZone'),'UTC',value].filter(Boolean))]
 return <select required aria-label={label} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}>{zones.map(zone=><option key={zone} value={zone}>{zone}</option>)}</select>
}
