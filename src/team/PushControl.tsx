import type {usePush,Choices} from '../push/client'
export function PushControl({push}:{push:ReturnType<typeof usePush>}){
 const {settings,permission,enabled,error,busy,change,enable,disable,install,standalone,installApp}=push
 const choice=(key:keyof Choices,label:string)=><label key={key}><input type="checkbox" checked={!!settings?.[key]} disabled={busy||!enabled} onChange={e=>void change({[key]:e.target.checked})}/>{label}</label>
 return <section className="team-notifications email-notifications" aria-labelledby="push-title"><strong id="push-title">Push notifications</strong><p>Alerts on this device when you are away. Message text stays in Nook.</p>
 {permission==='unsupported'?<p>Push is unavailable here. On iPhone or iPad, add Nook to your Home Screen, then open it there.</p>:permission==='denied'?<p>Notifications are blocked in browser settings.</p>:<button className="soft-button" disabled={busy} onClick={()=>void (enabled?disable():enable()).catch(()=>{})}>{enabled?'Turn push off on this device':'Enable push on this device'}</button>}
 {settings&&<>{choice('mentions','Mentions and commitments')}{choice('urgent','Urgent requests')}{choice('urgentQuiet','Let urgent requests through quiet time')}{choice('direct','Direct messages')}{choice('threads','Replies to threads I follow')}</>}
 {error&&<p role="alert">{error}</p>}{settings?.problems.length? <p role="status">Push not delivered: {settings.problems[0].error}{settings.problems[0].state==='retrying'?' (retrying)':''}. If this device is no longer subscribed, enable it again.</p>:null}
 {!!settings?.notDelivered.length&&<p>Push not delivered to {settings.notDelivered[0].recipient}: {settings.notDelivered[0].error}.</p>}
 {!!settings?.workspace?.count&&<p>Workspace: {settings.workspace.count} push deliveries need attention; latest: {settings.workspace.error}{settings.workspace.state==='retrying'?' (retrying)':''}.</p>}
 {!standalone&&(install?<button className="soft-button" onClick={installApp}>Install Nook</button>:<p>Install Nook from your browser menu. On iPhone or iPad, use Share → Add to Home Screen.</p>)}
 </section>
}
