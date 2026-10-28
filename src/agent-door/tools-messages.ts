import { type Spec,read,outcome,write,channelDetails,updateChannel,archiveChannel,leaveChannel,transferChannel,changeChannelMember,createNote,reviseNote,revertNote,getNote,listNotes,noteHistory,noteProposals,proposeNoteItem,react,reactions,reactionActors,save,listSaved,deleteSaved,pins,pin,messageCollections,personalWorkspace,updatePersonalWorkspace,str,body,number,bool,list,input,noteFields,payload,standard,membershipRisk,conversationVersion,messageVersion } from './tool-native'

export const messagesTools:Spec[]=[
 {name:'messages.list',clauses:['NOOK-002','NOOK-011'],read:true,schema:input({conversation:str,after:{type:'string',maxLength:128},limit:{type:'integer',minimum:1,maximum:100}},['conversation']),run:(c,a)=>read(c,'messages',a.conversation,payload(a,['after','limit']))},
 {name:'messages.read',clauses:['NOOK-001','NOOK-002'],read:true,schema:input({id:str}),area:'messages',run:(c,a)=>read(c,'message',a.id)},
 {name:'messages.post',clauses:['NOOK-002','NOOK-017'],schema:input({conversation:str,body,parent:str,attachments:{type:'array',items:str,maxItems:5},mentions:list},['conversation','body']),area:'messages',run:(c,a)=>write(c,'messages',a.conversation,{...payload(a,['body','parent','attachments','mentions']),intent:crypto.randomUUID()})},
 {name:'messages.edit',clauses:['NOOK-002'],schema:input({id:str,version:number,body}),area:'messages',revision:messageVersion,run:(c,a)=>write(c,'edit',a.id,{version:a.version,body:a.body})},
 {name:'messages.reactions',clauses:['NOOK-016'],read:true,schema:input({id:str}),run:(c,a)=>reactions(c,a.id)},
 {name:'messages.react',clauses:['NOOK-016'],schema:input({id:str,emoji:{enum:['👍','❤️','🎉','👀','✅','🙌']},add:bool}),run:(c,a)=>react(c,a.id,{emoji:a.emoji,add:a.add})},
 {name:'messages.reaction_people',clauses:['NOOK-016'],read:true,schema:input({id:str,emoji:str,after:str},['id','emoji']),run:(c,a)=>reactionActors(c,a.id,a.emoji,a.after??'')},
 {name:'messages.collections',clauses:['NOOK-020'],read:true,schema:input({id:str}),run:(c,a)=>messageCollections(c,a.id)},
 {name:'threads.list',clauses:['NOOK-072'],read:true,schema:input({}),run:c=>read(c,'threads')},
 {name:'threads.follow',clauses:['NOOK-072'],schema:input({id:str,followed:bool}),run:(c,a)=>write(c,'follow',a.id,{follow:a.followed})},
 {name:'search.messages',clauses:['NOOK-019'],read:true,schema:input({q:{type:'string',minLength:1,maxLength:200}}),run:(c,a)=>read(c,'search','',{q:a.q})},
]
