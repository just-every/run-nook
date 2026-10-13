import {useEffect,useState} from 'react'
import {createOwnerEditor} from '../base/modules/editor/src/index'

/** Mounted in the actual React homepage route; authority is read from native HTTP. */
export function OwnerShell() {
 const [error,setError]=useState('')
 useEffect(()=>{
  // The server marks documents served to a current owner; nobody else asks for editor authority.
  if(!document.querySelector('meta[name="nook-editor-owner"]'))return
  const editor=createOwnerEditor()
  let identity='',generation=0,disposed=false,abort:AbortController|undefined
  const revoke=()=>{generation++;abort?.abort();identity='';editor.setOwner(false);setError('')}
  async function refresh() {
   const current=++generation
   abort?.abort();abort=new AbortController()
   try {
    const response=await fetch('/api/editor/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:abort.signal})
    if(current!==generation||disposed)return
    if(!response.ok){revoke();return}
    const data=await response.json()
    if(current!==generation||disposed)return
    if(!data||typeof data!=='object'||!('ownerKey' in data)||typeof data.ownerKey!=='string'||!/^[a-f0-9]{64}$/.test(data.ownerKey))throw Error('Invalid owner session')
    if(identity!==data.ownerKey){identity=data.ownerKey;editor.setOwner(true)}
    const key=identity
    await editor.refresh(async signal=>{
     const grant=await fetch('/api/editor/config',{credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{'X-Nook-Editor-Owner':key}})
     if(!grant.ok)throw Error('The page editor is unavailable. Check the owner editor configuration.')
     return grant.json()
    })
    if(current===generation&&!disposed)setError('')
   } catch(error) {
    if(current!==generation||disposed)return
    editor.revoke();setError(error instanceof Error?error.message:'The page editor is unavailable.')
   }
  }
  const focus=()=>void refresh()
  const visibility=()=>{if(document.visibilityState==='visible')void refresh()}
  window.addEventListener('focus',focus)
  document.addEventListener('visibilitychange',visibility)
  void refresh()
  // A server-side demotion or revocation is bounded by the grant expiry even if this fails.
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15_000)
  return ()=>{disposed=true;generation++;abort?.abort();clearInterval(timer);editor.dispose();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility)}
 },[])
 return error?<p role="alert" className="nook-editor-error">{error}</p>:null
}
