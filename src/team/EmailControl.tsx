import {DigestSettings} from '../digests/DigestSettings'
import {QuietSettings} from '../notify/QuietSettings'
import {KeywordSettings} from '../notify/KeywordSettings'
import {useEffect,useState} from 'react'
import type {TeamRequest} from './types'
type Problem={error:string;retrying?:boolean;at:number}
type Settings={broadcasts:boolean;mentions:boolean;urgent:boolean;urgentQuiet:boolean;address:string;problem:Problem|null;notDelivered:(Problem&{recipient:string})[];workspace:{sending:'suppressed'|'provider'|'not-set-up';notDelivered:(Problem&{count:number})|null}|null}
const reasons:Record<string,string>={'not-set-up':'email sending is not set up','refused':'the mail service refused it','rate-limited':'the mail service asked Nook to slow down','uncertain':'the mail service did not confirm it'}
const when=(at:number)=>new Date(at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
const why=(p:Problem)=>`${reasons[p.error]??'it could not be sent'}, ${when(p.at)}${p.retrying?'; trying again':''}`
// C14: email is off until the member turns it on. Choices save as they change.
export function EmailControl({request,initial,localDevelopment=false}:{request:TeamRequest;initial?:Settings;localDevelopment?:boolean}){
 const [settings,setSettings]=useState<Settings|null>(initial??null),[notice,setNotice]=useState('')
 useEffect(()=>{setSettings(initial??null)},[initial])
 async function change(key:'mentions'|'broadcasts'|'urgent'|'urgentQuiet',value:boolean){setNotice('');try{setSettings(await request<Settings>('/api/notify',{method:'PATCH',body:JSON.stringify({[key]:value})}));setNotice('Email settings saved.')}catch{setNotice('Email settings were not saved.')}}
 if(!settings)return null
 const choice=(key:'mentions'|'broadcasts'|'urgent'|'urgentQuiet',label:string,disabled=false,className?:string)=><label className={className}><input type="checkbox" checked={settings[key]} disabled={disabled} onChange={event=>void change(key,event.target.checked)}/>{label}</label>
 return <><section className="team-notifications email-notifications" aria-labelledby="email-notifications-title"><strong id="email-notifications-title">Email me when…</strong>
  {choice('mentions','Someone mentions me or asks me to take on a commitment')}
  {choice('broadcasts','Someone uses @channel, @here or @everyone')}
  {choice('urgent','Someone sends me an urgent request')}
  {choice('urgentQuiet','Let urgent requests through quiet time',!settings.urgent,'email-sub')}
  {localDevelopment?<p className="email-setup">Local development mail is silently suppressed. No email is sent or saved.</p>:<p>Email goes to <strong>{settings.address}</strong>, the address you sign in with. It names who and where, never message text.</p>}
  {settings.problem&&<p className="email-problem">Email not delivered to you: {why(settings.problem)}.</p>}
  {settings.notDelivered.length>0&&<ul aria-label="Email about your messages that was not delivered">{settings.notDelivered.map((p,i)=><li key={i} className="email-problem">Email not delivered to {p.recipient}: {why(p)}.</li>)}</ul>}
  {settings.workspace?.sending==='not-set-up'&&<p className="email-setup">Email sending is not set up. <a href="/docs/updating#deploy-from-the-owners-cloudflare-account">Set up mail</a></p>}
  {settings.workspace?.notDelivered&&<p className="email-problem">Workspace: {settings.workspace.notDelivered.count} {settings.workspace.notDelivered.count===1?'email':'emails'} not delivered in the last 7 days; latest: {why(settings.workspace.notDelivered)}.</p>}
  <p className="email-notice" role="status">{notice}</p>
 </section><KeywordSettings request={request}/><QuietSettings request={request}/><DigestSettings request={request}/></>
}
