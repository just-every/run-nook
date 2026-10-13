// Local-only: product admission for the dev personas. Base's dev layer creates the operator; Nook
// admits people explicitly (nook_access), so a persona who signs in would otherwise be refused by
// the product. Only src/server.dev.ts imports this file.
const PERSONA_DOMAIN='dev.localhost'

export async function admitPersona(db:D1Database,as:string){
 const email=`${as}@${PERSONA_DOMAIN}`
 const operator=await db.prepare("SELECT id FROM oa_operators WHERE email=? AND status='active'").bind(email).first<{id:string}>()
 if(!operator)return
 const guest=as==='guest'
 await db.prepare('INSERT INTO nook_access(user,mode,active,generation) VALUES(?,?,1,1) ON CONFLICT(user) DO UPDATE SET active=1').bind(operator.id,guest?'guest':'member').run()
 if(!guest)return
 // A guest sees only what it is granted: the oldest channel, so the persona shows a scoped workspace.
 const channel=await db.prepare("SELECT id FROM nook_conversations WHERE kind='channel' ORDER BY rowid LIMIT 1").first<{id:string}>()
 if(channel)await db.prepare('INSERT OR IGNORE INTO nook_guest_grants(user,conversation) VALUES(?,?)').bind(operator.id,channel.id).run()
 if(channel)await db.prepare('INSERT OR IGNORE INTO nook_members(conversation,user) VALUES(?,?)').bind(channel.id,operator.id).run()
}

// `rer export` suspends the personas; signing in as one again brings it back (Base's dev layer refuses an inactive operator).
export async function reactivatePersona(db:D1Database,as:string){
 await db.prepare("UPDATE oa_operators SET status='active' WHERE email=? AND status='inactive'").bind(`${as}@${PERSONA_DOMAIN}`).run()
}
