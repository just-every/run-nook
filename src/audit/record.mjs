// NOOK-051: one body-free audit row. Doors add the returned statement to the same
// D1 batch as their effect, so a refused write commits neither. `conversation`
// derives the scope kind (channel, private or dm) from the conversation itself.
// `detail` holds counts and labels only: never a message body, email or secret.
const now=()=>Date.now();
export function auditStatement(db,{id=crypto.randomUUID(),actor=null,service=null,kind,scope='workspace',conversation,person,version=null,reason,outcome='confirmed',subject=null,detail={},settles=null,at=now()}){
 const values=[id,at,actor,service,kind];
 if(conversation)return db.prepare("INSERT INTO nook_audit(id,at,actor,service,kind,scope_kind,scope,version,reason,outcome,subject,detail,settles) SELECT ?,?,?,?,?,CASE kind WHEN 'dm' THEN 'dm' WHEN 'private' THEN 'private' ELSE 'channel' END,id,?,?,?,?,?,? FROM nook_conversations WHERE id=?").bind(...values,version,reason,outcome,subject,JSON.stringify(detail),settles,conversation);
 return db.prepare('INSERT INTO nook_audit(id,at,actor,service,kind,scope_kind,scope,version,reason,outcome,subject,detail,settles) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,person?'person':scope,person??null,version,reason,outcome,subject,JSON.stringify(detail),settles);
}
// Settles an uncertain row once its external effect is known.
export function settleStatement(db,settles,{actor=null,service=null,kind,outcome,reason,detail={}}){
 return db.prepare('INSERT INTO nook_audit(id,at,actor,service,kind,scope_kind,scope,version,reason,outcome,subject,detail,settles) SELECT ?,?,?,?,?,scope_kind,scope,version,?,?,subject,?,id FROM nook_audit WHERE id=?').bind(crypto.randomUUID(),now(),actor,service,kind,reason,outcome,JSON.stringify(detail),settles);
}
