/** One short day style: "Tuesday 27 Oct", with the year only when it is not this one. */
export function dayLabel(value:string|number|Date){
 const date=new Date(value),part=(options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',options).format(date)
 return `${part({weekday:'long'})} ${date.getDate()} ${part({month:'short'})}${date.getFullYear()===new Date().getFullYear()?'':' '+date.getFullYear()}`
}
/** The local calendar day a timestamp falls on, for telling where a day changes. */
export const dayKey=(value:string|number|Date)=>{const date=new Date(value);return date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate()}
/** A date-only deadline ("2026-10-31") in the same short style the cards use. */
export const dueDate=(deadline:string)=>{const date=new Date(deadline+'T00:00');return Number.isNaN(date.getTime())?deadline:date.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}
