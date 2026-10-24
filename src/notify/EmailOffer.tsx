import {useState} from 'react';
import {api} from '../chat/api';
export function EmailOffer({visible,onSaved}:{visible:boolean;onSaved:()=>void}){
 const [interval,setInterval]=useState(15),[error,setError]=useState('');
 if(!visible)return null;
 const choose=async(enabled:boolean)=>{try{await api('notify',{awayEmail:enabled,awayInterval:interval,dismissEmailOffer:true},'PATCH');onSaved()}catch(error){setError((error as Error).message)}};
 return <section className="team-section" aria-label="Email notification offer"><p>Email is off. You can get bundled email about mentions and DMs while you’re away.</p><label>Bundle interval<select value={interval} onChange={event=>setInterval(Number(event.target.value))}><option value={15}>Every 15 minutes</option><option value={60}>Hourly</option></select></label><button className="soft-button" onClick={()=>void choose(true)}>Email me about mentions and DMs when I’m away</button><button className="text-button" onClick={()=>void choose(false)}>Keep email off</button>{error&&<p role="alert">{error}</p>}</section>;
}
