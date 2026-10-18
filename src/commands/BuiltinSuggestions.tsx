import {builtins} from './catalog'
export function BuiltinSuggestions({body,onChoose}:{body:string;onChoose:(value:string)=>void}){
 if(!/^\/[a-z]*$/i.test(body))return null
 const choices=builtins.filter(([name])=>name.startsWith(body.slice(1).toLowerCase()))
 return <div className="builtin-suggestions" aria-label="Built-in commands" style={{flexBasis:'100%',maxHeight:220,overflowY:'auto',display:'grid',gap:4}}>{choices.map(([name,args,description])=><button className="soft-button" type="button" key={name} style={{whiteSpace:'normal',textAlign:'left'}} onClick={()=>onChoose('/'+name+(args?' ':''))}><strong>/{name}</strong> {args} · {description}</button>)}</div>
}
