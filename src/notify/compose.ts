import type {Reason} from './queue'
// C14 decision (b): an email names the sender, the conversation and a link. It
// never carries message text, file names, urgent reasons or commitment wording,
// so it is built only from names and IDs.
export type EmailInput={workspace:string;origin:string;actor:string;conversation:{id:string;name:string;kind:string};reason:Reason;message:string|null;count:number;token:string}
const where=(c:EmailInput['conversation'])=>c.kind==='dm'?'a direct conversation':'#'+c.name
const subjects:Record<Reason,(actor:string,place:string)=>string>={
 'direct-message':(a,p)=>`${a} sent you a message in ${p}`,
 'broadcast':(a,p)=>`${a} sent a channel-wide mention in ${p}`,
 'mention':(a,p)=>`${a} mentioned you in ${p}`,
 'keyword':(a,p)=>`${a} wrote a message with one of your keywords in ${p}`,
 'urgent-request':(a,p)=>`Urgent request from ${a} in ${p}`,
 'commitment-proposal':(a,p)=>`${a} asked you to take on a commitment in ${p}`,
 'commitment-revision':(a,p)=>`${a} changed a commitment they asked of you in ${p}`,
 'commitment-complete':(a,p)=>`${a} reported a commitment complete in ${p}`,
}
export function composeEmail(input:EmailInput){
 const place=where(input.conversation),more=input.count-1,line=subjects[input.reason](input.actor,place)
 const open=new URL('/app',input.origin);open.searchParams.set('conversation',input.conversation.id);if(input.message)open.searchParams.set('focus',input.message);else open.searchParams.set('panel','outcomes')
 const off=new URL('/notify/off',input.origin);off.searchParams.set('t',input.token)
 const manage=new URL('/app',input.origin);manage.searchParams.set('view','you')
 const text=[
  line+'.',
  '',
  `Open it in ${input.workspace}: ${open}`,
  ...(more>0?['',`There ${more===1?'is 1 more update':`are ${more} more updates`} for you in ${place}.`]:[]),
  '',
  'Message text is not included in email.'+(input.reason==='urgent-request'?' Urgent requests are requests inside Nook, not pages.':''),
  '',
  `You get these emails because you turned them on in ${input.workspace}.`,
  `Turn these emails off: ${off}`,
  `Manage email settings: ${manage}`,
 ].join('\n')
 return {subject:line+(more>0?` (+${more} more)`:''),text}
}
