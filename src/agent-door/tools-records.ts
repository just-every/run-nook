import {type Spec,input,str,number,bool,list,payload,read} from './tool-native'
import {createPoll,readPoll,vote,closePoll} from '../team/polls.server'
import {bookmarks,addBookmark,reorderBookmarks,removeBookmark} from '../team/bookmarks.server'
import {listFiles} from '../files/server'

const bookmarkVersion=async(c:Parameters<Spec['run']>[0],a:Record<string,any>)=>(await bookmarks(c,a.conversation)).version
export const recordTools:Spec[]=[
 {name:'polls.create',clauses:['NOOK-070'],schema:input({conversation:str,question:{type:'string',minLength:1,maxLength:500},options:{type:'array',minItems:2,maxItems:20,items:{type:'string',minLength:1,maxLength:120}},multiple:bool,anonymous:{const:true},closes:{type:['integer','null']}},['conversation','question','options','multiple','anonymous']),area:'messages',run:(c,a)=>createPoll(c,a.conversation,{...payload(a,['question','options','multiple','anonymous','closes']),intent:crypto.randomUUID()})},
 {name:'polls.read',clauses:['NOOK-070'],read:true,schema:input({id:str}),run:(c,a)=>readPoll(c,a.id)},
 {name:'polls.vote',clauses:['NOOK-070'],schema:input({id:str,choices:{type:'array',maxItems:20,uniqueItems:true,items:number}}),run:(c,a)=>vote(c,a.id,{choices:a.choices})},
 {name:'polls.close',clauses:['NOOK-070'],schema:input({id:str}),run:(c,a)=>closePoll(c,a.id,{})},
 {name:'bookmarks.list',clauses:['NOOK-070'],read:true,schema:input({conversation:str}),run:(c,a)=>bookmarks(c,a.conversation)},
 {name:'bookmarks.add',clauses:['NOOK-070'],schema:input({conversation:str,kind:{enum:['link','file','folder']},title:{type:'string',minLength:1,maxLength:80},url:{type:'string',maxLength:2048},file:str,parent:{type:['string','null']}},['conversation','kind','title']),run:(c,a)=>addBookmark(c,a.conversation,payload(a,['kind','title','url','file','parent']))},
 {name:'bookmarks.reorder',clauses:['NOOK-070'],schema:input({conversation:str,version:{type:'integer',minimum:0},parent:{type:['string','null']},order:list}),revision:bookmarkVersion,run:(c,a)=>reorderBookmarks(c,a.conversation,payload(a,['version','parent','order']))},
 {name:'bookmarks.remove',clauses:['NOOK-070'],schema:input({conversation:str,id:str}),run:(c,a)=>removeBookmark(c,a.conversation,a.id)},
 {name:'files.list',clauses:['NOOK-012','NOOK-061'],read:true,schema:input({conversation:str,after:str,q:{type:'string',maxLength:200}},['conversation']),run:(c,a)=>listFiles(c,payload(a,['conversation','after','q']))},
 {name:'conversations.replay',clauses:['NOOK-011'],read:true,schema:input({conversation:str,after:{type:'integer',minimum:0}},['conversation']),run:(c,a)=>read(c,'replay',a.conversation,payload(a,['after']))},
 {name:'conversations.roster',clauses:['NOOK-003'],read:true,schema:input({conversation:str}),run:(c,a)=>read(c,'roster',a.conversation)},
]
