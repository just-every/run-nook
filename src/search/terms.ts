export type SearchTerm={value:string;prefix:boolean;exclude:boolean;phrase:boolean}
export const searchFold=(value:string)=>value.normalize('NFC').toLocaleLowerCase('en-US')
export function searchWords(value:string){return searchFold(value).match(/[\p{L}\p{N}\p{M}_]+/gu)??[]}
/** Every positive expression must match. Bare terms include substrings, quoted
 * phrases keep their spacing, and * explicitly selects a Unicode token prefix. */
export function matchesSearch(values:string[],terms:SearchTerm[]){
 const bodies=values.map(searchFold),words=values.flatMap(searchWords)
 return terms.every(term=>{
  const found=term.prefix?words.some(word=>word.startsWith(term.value)):bodies.some(body=>body.includes(term.value))
  return term.exclude?!found:found
 })
}
export function searchExcerpt(value:string,terms:SearchTerm[],limit=360){
 const folded=searchFold(value),at=Math.min(...terms.filter(t=>!t.exclude).map(t=>folded.indexOf(t.value)).filter(n=>n>=0)),start=Number.isFinite(at)?Math.max(0,at-90):0
 return (start?'…':'')+value.slice(start,start+limit)+(value.length>start+limit?'…':'')
}
