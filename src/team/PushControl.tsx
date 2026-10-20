import {DeviceDelivery} from '../push/DeviceDelivery'
import {useId} from 'react'
import type {usePush,Choices} from '../push/client'
export function PushControl({push}:{push:ReturnType<typeof usePush>}){
 const deviceId=useId()
 const {settings,permission,enabled,error,busy,change,enable,disable,install,standalone,installApp}=push
 const choice=(key:Exclude<keyof Choices,'threadBadge'>,label:string)=><label key={key}><input type="checkbox" checked={!!settings?.[key]} disabled={busy||!enabled} onChange={e=>void change({[key]:e.target.checked})}/>{label}</label>
 return <section className="team-notifications email-notifications" aria-labelledby="push-title"><strong id="push-title">Push notifications</strong><p>Alerts on this device when you are away. Message text stays in Nook.</p>
 {permission==='unsupported'?<p>Push is unavailable here. On iPhone or iPad, add Nook to your Home Screen, then open it there.</p>:permission==='denied'?<p>Notifications are blocked in browser settings.</p>:<button className="soft-button" disabled={busy} onClick={()=>void (enabled?disable():enable()).catch(()=>{})}>{enabled?'Turn push off on this device':'Enable push on this device'}</button>}
 {settings&&<>{choice('mentions','Mentions and commitments')}{choice('broadcasts','Channel-wide mentions')}{choice('urgent','Urgent requests')}{choice('urgentQuiet','Let urgent requests through quiet time')}{choice('direct','Direct messages')}{choice('threads','Replies to threads I follow')}</>}
 {settings&&<label><input type="checkbox" checked={settings.threadBadge==='mentions'} disabled={busy} onChange={e=>void change({threadBadge:e.target.checked?'mentions':'all'})}/>Count thread replies only when they mention me</label>}<p>Threads still shows every followed reply. This counting choice changes unread and badges, without reading messages or silencing alerts.</p>{settings&&<div className="field"><label htmlFor={deviceId}>This device</label><select id={deviceId} aria-label="This device" value={push.deviceClass} disabled={busy} onChange={e=>void push.changeDeviceClass(e.target.value as 'desktop'|'mobile')}><option value="desktop">Desktop or web</option><option value="mobile">Phone or tablet</option></select></div>}
 {error&&<p role="alert">{error}</p>}{settings?.problems.length? <p role="status">Push not delivered: {settings.problems[0].error}{settings.problems[0].state==='retrying'?' (retrying)':''}. If this device is no longer subscribed, enable it again.</p>:null}
 {!!settings?.notDelivered.length&&<p>Push not delivered to {settings.notDelivered[0].recipient}: {settings.notDelivered[0].error}.</p>}
 {!!settings?.workspace?.count&&<p>Workspace: {settings.workspace.count} push deliveries need attention; latest: {settings.workspace.error}{settings.workspace.state==='retrying'?' (retrying)':''}.</p>}
 {!standalone&&(install?<button className="soft-button" onClick={installApp}>Install Nook</button>:<p>Install Nook from your browser menu. On iPhone or iPad, use Share → Add to Home Screen.</p>)}
 <DeviceDelivery request={push.request} signal={push.privateSignal}/>
 </section>
}
