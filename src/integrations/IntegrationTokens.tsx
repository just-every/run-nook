import {useEffect,useState} from 'react'
import type {ChannelChoice,TeamRequest} from '../team/types'
import './integrations.css'
type Token={id:string;name:string;state:'active'|'rotated'|'revoked';created:number;ended:number|null;creatorName:string;lastUsed:number|null;conversations:{id:string;name:string}[]}
type Activity={id:string;name:string;at:number;action:string;code:string|null;route:string|null;conversationName:string|null;actorName:string|null}
type Listing={tokens:Token[];audit:Activity[];secret?:string}
const when=(at:number)=>new Date(at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})
const described:Record<string,string>={create:'Created',rotate:'Rotated',revoke:'Revoked',post:'Posted',replay:'Repeated post (same key, no new message)',refuse:'Refused'}
// NOOK-079: owners create, rotate and revoke integration tokens. A secret is shown once.
export function IntegrationTokens({request,channels}:{request:TeamRequest;channels:ChannelChoice[]}){
 const [listing,setListing]=useState<Listing|null>(null),[name,setName]=useState(''),[chosen,setChosen]=useState<string[]>([]),[secret,setSecret]=useState<{name:string;value:string}|null>(null),[confirming,setConfirming]=useState<string|null>(null),[notice,setNotice]=useState('')
 useEffect(()=>{let live=true;void request<Listing>('/api/integrations/tokens').then(l=>{if(live)setListing(l)}).catch(()=>{if(live)setNotice('Integration tokens could not be loaded. Reload to try again.')});return()=>{live=false}},[request])
 const act=async(path:string,body:unknown,label:string,done:string)=>{
  try{const next=await request<Listing>(path,{method:'POST',body:JSON.stringify(body)});setListing(next);if(next.secret)setSecret({name:label,value:next.secret});setNotice(done)}
  catch(error){setNotice(error instanceof Error?error.message:'That change was not saved.')}
 }
 const eligible=channels.filter(c=>c.kind==='channel'||c.kind==='private')
 return <section className="team-section integration-tokens" aria-labelledby="integration-tokens-heading">
  <h2 id="integration-tokens-heading">Integration tokens</h2>
  <p className="team-lead">Let another service post into chosen channels without anyone's sign-in. A token only posts messages, appears as you with “via” its name, and every use is recorded below.</p>
  {secret&&<div className="integration-secret" role="region" aria-label="New token"><p><strong>Copy the token for {secret.name} now.</strong> Nook keeps only a sealed hash, so it is shown this once.</p><code>{secret.value}</code><div className="integration-actions"><button className="soft-button" onClick={()=>void navigator.clipboard?.writeText(secret.value).then(()=>setNotice('Token copied.'),()=>setNotice('Select the token and copy it.'))}>Copy token</button><button className="text-button" onClick={()=>setSecret(null)}>Done</button></div></div>}
  <form className="integration-create" onSubmit={event=>{event.preventDefault();void act('/api/integrations/tokens',{name,conversations:chosen},name,'Token created.').then(()=>{setName('');setChosen([])})}}>
   <label className="field">Integration name<input required maxLength={80} value={name} placeholder="Vane reports" onChange={event=>setName(event.target.value)}/></label>
   <fieldset><legend>Channels it may post to</legend>{eligible.map(c=><label className="check" key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={event=>setChosen(event.target.checked?[...chosen,c.id]:chosen.filter(id=>id!==c.id))}/>#{c.name}</label>)}</fieldset>
   <button className="soft-button" disabled={!name.trim()||!chosen.length}>Create token</button>
  </form>
  <ul className="integration-list" aria-label="Integrations">{listing?.tokens.map(t=><li key={t.id}><article aria-label={t.name}>
   <h3>{t.name} <span className={'integration-state '+t.state}>{t.state==='active'?'Active':'Revoked'}</span></h3>
   <p>Posts to {t.conversations.map(c=>'#'+c.name).join(', ')||'no current channel'} · created by {t.creatorName} · {t.lastUsed?'last used '+when(t.lastUsed):'not used yet'}</p>
   {t.state==='active'&&<div className="integration-actions">
    <button className="soft-button" onClick={()=>void act(`/api/integrations/tokens/${t.id}/rotate`,{},t.name,'Token rotated. The previous token no longer works.')}>Rotate {t.name}</button>
    {confirming===t.id?<><button className="soft-button danger" onClick={()=>{setConfirming(null);void act(`/api/integrations/tokens/${t.id}/revoke`,{},t.name,'Token revoked.')}}>Confirm revoke {t.name}</button><button className="text-button" onClick={()=>setConfirming(null)}>Keep it</button></>
    :<button className="text-button" onClick={()=>setConfirming(t.id)}>Revoke {t.name}</button>}
   </div>}
  </article></li>)}</ul>
  {listing&&listing.audit.length>0&&<div className="integration-audit"><h3>Recent token activity</h3><table><thead><tr><th scope="col">When</th><th scope="col">Integration</th><th scope="col">What happened</th><th scope="col">Where</th></tr></thead><tbody>{listing.audit.map(a=><tr key={a.id}><td>{when(a.at)}</td><td>{a.name}</td><td>{described[a.action]??a.action}{a.code?` (${a.code})`:''}{a.actorName&&['create','rotate','revoke'].includes(a.action)?` by ${a.actorName}`:''}</td><td>{a.conversationName?'#'+a.conversationName:a.route??''}</td></tr>)}</tbody></table></div>}
  <p role="status">{notice}</p>
 </section>
}
