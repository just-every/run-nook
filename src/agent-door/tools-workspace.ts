import { type Spec,read,outcome,write,channelDetails,updateChannel,archiveChannel,leaveChannel,transferChannel,changeChannelMember,createNote,reviseNote,revertNote,getNote,listNotes,noteHistory,noteProposals,proposeNoteItem,react,reactions,reactionActors,save,listSaved,deleteSaved,pins,pin,messageCollections,personalWorkspace,updatePersonalWorkspace,str,body,number,bool,list,input,noteFields,payload,standard,membershipRisk,conversationVersion,messageVersion } from './tool-native'

export const workspaceTools:Spec[]=[
 {name:'attention.history',clauses:['NOOK-005','NOOK-013'],read:true,schema:input({}),run:c=>c.rows('SELECT a.id,a.state,a.snooze_until,a.conversation FROM nook_attention a JOIN nook_members m ON m.conversation=a.conversation AND m.user=a.user JOIN oa_operators o ON o.id=m.user JOIN nook_access x ON x.user=o.id WHERE a.user=? AND o.status=\'active\' AND x.active=1 AND (x.mode=\'member\' OR EXISTS(SELECT 1 FROM nook_guest_grants g WHERE g.user=m.user AND g.conversation=m.conversation)) ORDER BY a.id LIMIT 1000',[c.uid])},
 {name:'identity.read',clauses:['NOOK-001'],read:true,schema:input({}),run:c=>read(c,'me')},
 {name:'attention.read',clauses:['NOOK-005','NOOK-013'],read:true,schema:input({}),run:c=>read(c,'attention')},
 {name:'attention.update',clauses:['NOOK-013'],schema:input({id:str,action:{enum:['done','snooze']},until:{type:'integer'}},['id','action']),run:(c,a)=>write(c,'attentionAction',a.id,payload(a,['action','until']))},
 {name:'saved.list',clauses:['NOOK-020'],read:true,schema:input({}),run:c=>listSaved(c)},
 {name:'saved.create',clauses:['NOOK-020'],schema:input({conversation:str,message:str}),run:(c,a)=>save(c,{conversation:a.conversation,message:a.message})},
 {name:'saved.remove',clauses:['NOOK-020'],schema:input({id:str}),run:(c,a)=>deleteSaved(c,a.id)},
 {name:'pins.list',clauses:['NOOK-020'],read:true,schema:input({conversation:str}),run:(c,a)=>pins(c,a.conversation)},
 {name:'pins.update',clauses:['NOOK-020'],schema:input({conversation:str,message:str,pinned:bool}),run:(c,a)=>pin(c,a.conversation,{message:a.message,pinned:a.pinned})},
 {name:'people.list',clauses:['NOOK-017'],read:true,schema:input({q:{type:'string',maxLength:200},after:str,limit:{type:'integer',minimum:1,maximum:1000}},[]),run:(c,a)=>read(c,'users','',payload(a,['q','after','limit']))},
 {name:'workspace.snapshot',clauses:['NOOK-001','NOOK-011','NOOK-051'],read:true,schema:input({}),run:async c=>{
  const conversations=await read(c,'conversations'),records=[]
  for(const room of conversations){
   const id=room.id
   records.push({conversation:await channelDetails(c,id),members:await read(c,'members',id),messages:await read(c,'messages',id),outcomes:await read(c,'outcomes',id),notes:await listNotes(c,id),preferences:await read(c,'preferences',id),...(room.kind!=='dm'?{pins:await pins(c,id)}:{})})
  }
  return {records,saved:await listSaved(c),workspace:await personalWorkspace(c),threads:await read(c,'threads'),settings:await read(c,'settings'),attention:await c.rows('SELECT id,state,snooze_until FROM nook_attention WHERE user=? ORDER BY id',[c.uid])}
 }},
 {name:'workspace.read',clauses:['NOOK-017'],read:true,schema:input({}),run:c=>personalWorkspace(c)},
]
