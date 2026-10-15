import {useState} from 'react'
import {NookFrame} from '../brand/NookFrame'
import {downloadWorkspace} from './download'

export function ExportScreen(){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 async function download(){
  setBusy(true);setError('');setNotice('Preparing your archive…')
  try{await downloadWorkspace(setNotice);setNotice('Your archive is ready. Keep it private and follow the restore guide before leaving hosting.')}
  catch(error){setNotice('');setError(error instanceof Error?error.message:'We couldn’t prepare the archive. Please try again.')}
  finally{setBusy(false)}
 }
 return <NookFrame id="export" label="Skip to workspace export">
  <h1>Take your workspace with you</h1>
  <p className="frame-lead">Download your conversations, messages, decisions, requests, files and attention choices, including imported history.</p>
  <p>Sign in as a workspace owner, then download a private Nook archive. Do this before you leave hosting.</p>
  <button className="frame-primary" type="button" disabled={busy} onClick={download}>{busy?'Preparing…':'Download workspace archive'}</button>
  {notice&&<p className="frame-notice" role="status">{notice}</p>}
  {error&&<p className="frame-notice" role="alert">{error}</p>}
  <p className="frame-small">Restore into an empty installation. Search is rebuilt from your messages; live connections reconnect using the restored history. Sessions and pending notifications do not travel.</p>
  <nav aria-label="Export and recovery"><p><a className="frame-link" href="/docs/backups">Read the restore guide</a></p><p><a className="frame-link" href="/signin?returnTo=%2Fexport">Sign in</a> · <a className="frame-link" href="/app">Back to Nook</a></p></nav>
 </NookFrame>
}
