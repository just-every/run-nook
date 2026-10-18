export async function validatePostingArchive(read,{manifest,actors,conversations,actions}){
 const rows=async name=>manifest?.tables&&!manifest.tables.some(t=>t.name===name)?[]:read(name);
 const [policies,people,changes]=await Promise.all(['nook_posting_policy','nook_posting_people','nook_posting_changes'].map(rows));
 const check=(value)=>{if(!value)throw Error('invalid_posting_permissions')};
 const level=value=>['everyone','admins','managers','selected'].includes(value),replies=value=>['everyone','same'].includes(value);
 const channels=new Set();for(const p of policies){check(Object.keys(p).sort().join()==='conversation,level,replies'&&conversations.has(p.conversation)&&conversations.get(p.conversation).kind!=='dm'&&!channels.has(p.conversation)&&level(p.level)&&replies(p.replies));channels.add(p.conversation)}
 const keys=new Set();for(const p of people){const key=JSON.stringify([p.conversation,p.user]);check(Object.keys(p).sort().join()==='conversation,user'&&channels.has(p.conversation)&&actors.has(p.user)&&!actors.get(p.user).erased&&!keys.has(key));keys.add(key)}
 const ids=new Set();for(const p of changes){check(Object.keys(p).sort().join()==='action,level,people,replies'&&actions.has(p.action)&&!ids.has(p.action)&&level(p.level)&&replies(p.replies)&&Number.isSafeInteger(p.people)&&p.people>=0);ids.add(p.action)}
}
