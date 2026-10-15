import type {Bindings} from '../platform/repository.server'
import type {User} from '../family/team-chat/domain'

/** Sample people are active members; Base creates and signs in the real demo owner. */
export async function demoPeople(env:Bindings,ownerEmail:string,now:Date):Promise<User[]>{
 const owner=await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{id:string}>()
 if(!owner)throw Error('Demo owner must exist before seeding')
 const people:User[]=[
  {id:owner.id,email:ownerEmail,name:'Jamie Taylor',role:'owner',active:true},
  {id:'demo-alex',email:'alex@demo.invalid',name:'Alex Chen',role:'member',active:true},
  {id:'demo-morgan',email:'morgan@demo.invalid',name:'Morgan Reed',role:'member',active:true},
 ]
 await env.DB.batch(people.flatMap(person=>[
  env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,?,'active',?) ON CONFLICT(id) DO NOTHING").bind(person.id,person.email!,person.name,person.role!,now.getTime()),
  env.DB.prepare('INSERT INTO nook_access(user,mode,active,generation) VALUES(?,\'member\',1,1) ON CONFLICT DO NOTHING').bind(person.id),
 ]))
 await env.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(people[0].name,owner.id).run()
 return people
}
