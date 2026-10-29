import {type Spec,input,str,number,bool,payload,read,write,updatePersonalWorkspace} from './tool-native'
import {readProfile,writeProfile,listPeople,listFields} from '../profiles/server'
import {sentMessages} from '../personal/sent.server'
import {readConversationNotify,updateConversationNotify,conversationNotifyExceptions} from '../team/conversation-notify.server'

export const personalTools:Spec[]=[
 {name:'profiles.read',clauses:['NOOK-017'],read:true,schema:input({user:str},[]),run:(c,a)=>readProfile(c,a.user??c.uid)},
 {name:'profiles.update',clauses:['NOOK-017'],schema:input({version:{type:'integer',minimum:0},name:{type:'string',maxLength:100},zone:{type:'string',maxLength:100},away:bool,presenceEnabled:bool,typingEnabled:bool,status:{type:['object','null'],properties:{emoji:{type:'string',maxLength:16},text:{type:'string',maxLength:100},clearAfter:{enum:['never','30m','1h','4h','today','week','date']},localAt:str},required:['emoji','text','clearAfter'],additionalProperties:false}},['version']),revision:async c=>(await readProfile(c)).profile.version,run:(c,a)=>writeProfile(c,payload(a,['version','name','zone','away','presenceEnabled','typingEnabled','status']))},
 {name:'profiles.fields',clauses:['NOOK-017'],read:true,schema:input({}),run:c=>listFields(c)},
 {name:'people.directory',clauses:['NOOK-017','NOOK-049'],read:true,schema:input({q:{type:'string',maxLength:200},field:str,value:{type:'string',maxLength:500},after:str,limit:{type:'integer',minimum:1,maximum:200}},[]),run:(c,a)=>listPeople(c,a)},
 {name:'workspace.organize',clauses:['NOOK-017'],schema:input({conversation:str,section:{type:'string',maxLength:80},position:{type:'integer',minimum:0,maximum:100000}},['conversation','section']),run:(c,a)=>updatePersonalWorkspace(c,a)},
 {name:'messages.sent',clauses:['NOOK-017'],read:true,schema:input({after:str},[]),run:(c,a)=>sentMessages(c,a.after??'')},
 {name:'notification_choices.read',clauses:['NOOK-072'],read:true,schema:input({conversation:str}),run:(c,a)=>readConversationNotify(c,a.conversation)},
 {name:'notification_choices.update',clauses:['NOOK-072'],schema:input({conversation:str,reset:{const:true},level:{enum:['all','mentions','nothing']},threads:{enum:['all','followed']},mobileLevel:{enum:['all','mentions','nothing',null]},mobileThreads:{enum:['all','followed',null]}},['conversation']),run:(c,a)=>updateConversationNotify(c,a.conversation,payload(a,['reset','level','threads','mobileLevel','mobileThreads']))},
 {name:'notification_choices.exceptions',clauses:['NOOK-072'],read:true,schema:input({}),run:c=>conversationNotifyExceptions(c)},
 {name:'quiet.read',clauses:['NOOK-013'],read:true,schema:input({}),run:c=>read(c,'settings')},
 {name:'quiet.update',clauses:['NOOK-013'],schema:input({dndUntil:{type:['integer','null']}}),run:(c,a)=>write(c,'settings','',a)},
]
