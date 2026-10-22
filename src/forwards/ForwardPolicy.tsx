import {useEffect,useState} from 'react'
import {api} from '../chat/api'
export function ForwardPolicy(){
 const [value,setValue]=useState<any>(null),[notice,setNotice]=useState('');useEffect(()=>{void api('forwards/policy').then(setValue).catch(e=>setNotice(e.message))},[])
 async function save(e:React.FormEvent){e.preventDefault();try{setValue(await api('forwards/policy',{mode:value.mode,version:value.version}));setNotice('Forwarding policy saved')}catch(e){setNotice((e as Error).message)}}
 return <section aria-label="Forwarding policy"><h2>Forwarding policy</h2>{value&&<form onSubmit={e=>void save(e)}><label className="field">Allowed forwarding<select aria-label="Allowed forwarding" value={value.mode} onChange={e=>setValue({...value,mode:e.target.value})}><option value="allow">Link only or Show message</option><option value="link-only">Link only everywhere</option><option value="blocked">Block forwarding</option></select></label><button className="soft-button">Save forwarding policy</button></form>}<p role="status">{notice}</p></section>
}
