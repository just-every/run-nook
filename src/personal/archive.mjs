const check=(ok)=>{if(!ok)throw Error('invalid_personal_workspace_archive')}
export async function validatePersonalWorkspace(read,manifest,actors,conversations){
 const load=name=>manifest?.tables&&!manifest.tables.some(t=>t.name===name)?[]:read(name)
 const [profiles,fields,values,actions,sections,installations]=await Promise.all(['nook_profiles','nook_profile_fields','nook_profile_values','nook_profile_field_actions','nook_personal_conversations','nook_personal_installations'].map(load))
 const ids=new Set(fields.map(f=>f.id))
 for(const f of fields)check(typeof f.id==='string'&&/^[a-z][a-z0-9-]*$/.test(f.id)&&f.id.length<=64&&typeof f.label==='string'&&f.label.length<=80&&['text','phone','date'].includes(f.type)&&['members','shared-conversation','admins','self'].includes(f.visibility)&&Number.isSafeInteger(f.position)&&f.position>=0&&Number.isSafeInteger(f.version)&&f.version>=1)
 for(const p of profiles){check((p.zone_chosen===undefined||[0,1].includes(p.zone_chosen))&&[0,1].includes(p.presence_enabled)&&[0,1].includes(p.typing_enabled)&&actors.has(p.user)&&typeof p.zone==='string'&&typeof p.status_text==='string'&&p.status_text.length<=160&&typeof p.status_emoji==='string'&&p.status_emoji.length<=64&&(p.status_expires===null||Number.isSafeInteger(p.status_expires))&&Number.isSafeInteger(p.version)&&p.version>=1&&Number.isSafeInteger(p.updated));try{new Intl.DateTimeFormat('en',{timeZone:p.zone})}catch{check(false)}}
 for(const v of values)check(actors.has(v.user)&&ids.has(v.field)&&typeof v.value==='string'&&v.value.length<=500)
 for(const a of actions)check(typeof a.id==='string'&&(a.actor===null||actors.has(a.actor))&&Number.isSafeInteger(a.created)&&Number.isSafeInteger(a.fields)&&a.fields>=0)
 for(const s of sections)check(actors.has(s.user)&&conversations.has(s.conversation)&&typeof s.section==='string'&&s.section.length<=80&&Number.isSafeInteger(s.position)&&s.position>=0)
 for(const i of installations){check(actors.has(i.user)&&typeof i.label==='string'&&i.label.length<=80);try{const url=new URL(i.origin);check(url.origin===i.origin&&!url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))}catch{check(false)}}
}
