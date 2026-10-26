import type {Person} from './types'
// Soft warm tints; each initial colour reads at 6.5:1 or more on its tint.
const colors=[['#f6e6e0','#7a3a3f'],['#f3e7da','#6a4a24'],['#efe4e6','#664054'],['#ece6df','#51443d'],['#f1e4dc','#5e3b30']]
export function Avatar({person,small=false,size}:{person:Person;small?:boolean;size?:number}) {
 const words=person.name.trim().split(/[\s_-]+/),initials=words.length>1?words.slice(-2).map(w=>w[0]).join(''):words[0].slice(0,2)
 let hash=0;for(const char of person.id)hash=(hash*31+char.charCodeAt(0))|0
 const [background,color]=colors[Math.abs(hash)%colors.length]
 return <span className={'avatar'+(small?' small':'')} aria-hidden="true" style={{background,color,...(size?{width:size,height:size}:{})}}>{initials.toUpperCase()}</span>
}
