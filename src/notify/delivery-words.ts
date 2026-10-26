const reasons:Record<string,string>={mention:'Mention',broadcast:'Channel mention',keyword:'Keyword match','urgent-request':'Urgent request','thread-follow':'Thread reply','conversation-follow':'Conversation update','commitment-proposal':'Commitment request','commitment-update':'Commitment update',dm:'Direct message',direct:'Direct message'}
const words=(value:string)=>value.replace(/[._-]+/g,' ').replace(/^./,letter=>letter.toUpperCase())
export const deliveryReason=(value:string)=>reasons[value]??words(value)
export const deliveryError=(value:string|null)=>value==='held-active-elsewhere'?'Read or dismissed while held':value&&/^[a-z]+(?:[._-][a-z]+)+$/.test(value)?words(value):value??'Source unavailable'
