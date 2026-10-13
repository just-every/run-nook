import {useState} from 'react'
import branding from './branding.json'
import {NookFrame} from './brand/NookFrame'

// The public loader provides only this presentation flag. Operator-auth owns
// invitations, link delivery and confirmation; production never advertises an outbox.
export function SignInScreen({developmentOutbox=false}:{developmentOutbox?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 async function signIn(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setNotice('');setError('')
  try{
   const response=await fetch('/auth/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),returnTo:'/app'})})
   if(!response.ok){const result=await response.json() as {error?:string};throw Error(result.error||'Sign-in is unavailable. Please try again.')}
   if(developmentOutbox)location.assign('/__dev/outbox')
   else setNotice('If your account is active, a sign-in link has been sent to your email.')
  }catch(error){setError(error instanceof Error?error.message:'Sign-in is unavailable. Please try again.')}
  finally{setBusy(false)}
 }
 return <NookFrame id="auth" label="Skip to sign in"><h1>Sign in to {branding.name}</h1><p className="frame-lead">Room for your team.</p><form method="post" action="/auth/magic-link" onSubmit={signIn}><label>Email<input id="auth-email" name="email" type="email" autoComplete="email" required/></label><input type="hidden" name="returnTo" value="/app"/><button className="frame-primary" type="submit" disabled={busy}>{busy?'Sending…':'Send sign-in link'}</button></form>{notice&&<p className="frame-notice" role="status">{notice}</p>}{error&&<p className="frame-notice" role="alert">{error}</p>}<p className="frame-small">{developmentOutbox?<>Open your sign-in link in the <a className="frame-link" href="/__dev/outbox">local development outbox</a>.</>:<>Check your email for your sign-in link.</>} Ask your workspace owner for an invitation.</p><nav aria-label="Public documentation"><a className="frame-link" href="/docs">Read the Nook guides</a></nav></NookFrame>
}
