// "Your workspaces" (NOOK-092) is kept on this device, never on a server. A browser
// keeps storage per origin, so each installation holds its own copy of the list.
// Opening another installation from the menu carries this copy in the URL fragment,
// which browsers never send to a server, and the receiver merges it.
export type WorkspaceEntry={origin:string;account:string;seen:number;name?:string}
export type DeviceList={entries:WorkspaceEntry[];removed:Record<string,number>}
export type Handoff={from:string}&DeviceList
const KEY='nook:workspaces:v1',FRAGMENT='nook-workspaces=',MAX=20
const loopback=['127.0.0.1','localhost','[::1]']
// An installation is an HTTPS origin, or a loopback origin for local installations.
export function installationOrigin(value:string):string|null{
 const typed=value.trim();if(!typed)return null
 try{
  const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(typed)?typed:'https://'+typed)
  if(url.username||url.password||url.search||url.hash||!['','/','/app'].includes(url.pathname))return null
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback.includes(url.hostname)))return null
  return url.origin
 }catch{return null}
}
const entry=(value:unknown):WorkspaceEntry|null=>{
 if(!value||typeof value!=='object')return null
 const {origin,account,seen,name}=value as Record<string,unknown>
 if(typeof origin!=='string'||installationOrigin(origin)!==origin||typeof account!=='string'||account.length>120||!Number.isSafeInteger(seen))return null
 return {origin,account,seen:seen as number,...(typeof name==='string'&&name.trim()&&name.length<=120?{name:name.trim()}:{})}
}
function decodeList(value:unknown):DeviceList{
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{}
 const entries=Array.isArray(raw.entries)?raw.entries.map(entry).filter((e):e is WorkspaceEntry=>Boolean(e)):[]
 const removed:Record<string,number>={}
 if(raw.removed&&typeof raw.removed==='object')for(const [origin,at] of Object.entries(raw.removed))if(installationOrigin(origin)===origin&&Number.isSafeInteger(at))removed[origin]=at as number
 return {entries:[...new Map(entries.map(e=>[e.origin,e])).values()].slice(0,MAX),removed}
}
export function readList():DeviceList{
 try{return decodeList(JSON.parse(localStorage.getItem(KEY)??'{}'))}catch{return {entries:[],removed:{}}}
}
function writeList(list:DeviceList):DeviceList{
 const next={entries:[...list.entries].sort((a,b)=>a.origin===location.origin?-1:b.origin===location.origin?1:b.seen-a.seen).slice(0,MAX),removed:list.removed}
 localStorage.setItem(KEY,JSON.stringify(next));return next
}
const upsert=(list:DeviceList,item:WorkspaceEntry):DeviceList=>{
 const {[item.origin]:_,...removed}=list.removed
 return {entries:[item,...list.entries.filter(e=>e.origin!==item.origin)],removed}
}
// The installation the browser is signed in to right now records itself.
export const recordCurrent=(account:string,name:string)=>writeList(upsert(readList(),{origin:location.origin,account,name,seen:Date.now()}))
// A typed address, or a link saved on the account by an earlier Nook version.
export function addOrigin(origin:string,{unlessRemoved=false}={}){
 const list=readList()
 if(list.entries.some(e=>e.origin===origin)||unlessRemoved&&list.removed[origin]!==undefined)return list
 return writeList(upsert(list,{origin,account:'',seen:Date.now()}))
}
// Removing forgets the entry on this device; it never signs that installation out.
export function removeOrigin(origin:string){
 const list=readList()
 return writeList({entries:list.entries.filter(e=>e.origin!==origin),removed:{...list.removed,[origin]:Date.now()}})
}
export function handoffUrl(target:string){
 const list=readList(),now=Date.now()
 const payload:Handoff={from:location.origin,entries:list.entries.map(e=>e.origin===location.origin?{...e,seen:now}:e),removed:list.removed}
 return `${target}/app#${FRAGMENT}${encodeURIComponent(JSON.stringify(payload))}`
}
// Reads and strips a handoff from the address. Entries this device already lists,
// and removals of them, merge at once; installations it has never listed come back
// as pending so the member confirms them (a link from anywhere can carry a fragment).
export function receiveHandoff():{list:DeviceList;pending:Handoff|null}{
 const at=location.hash.indexOf(FRAGMENT)
 if(at<0)return {list:readList(),pending:null}
 let incoming:Handoff|null=null
 try{const raw=JSON.parse(decodeURIComponent(location.hash.slice(at+FRAGMENT.length)));const list=decodeList(raw);if(typeof raw.from==='string'&&installationOrigin(raw.from)===raw.from)incoming={from:raw.from,...list}}catch{incoming=null}
 history.replaceState(history.state,'',location.pathname+location.search)
 if(!incoming)return {list:readList(),pending:null}
 let list=readList();const fresh:WorkspaceEntry[]=[]
 for(const item of incoming.entries){
  if(item.origin===location.origin)continue
  const known=list.entries.find(e=>e.origin===item.origin)
  if(known){if(item.seen>known.seen)list=upsert(list,{...item,account:item.account||known.account,name:item.name||known.name})}
  else if((list.removed[item.origin]??-1)<item.seen)fresh.push(item)
 }
 for(const [origin,at] of Object.entries(incoming.removed)){
  const known=list.entries.find(e=>e.origin===origin)
  if(origin!==location.origin&&known&&known.seen<at)list={entries:list.entries.filter(e=>e.origin!==origin),removed:{...list.removed,[origin]:at}}
 }
 return {list:writeList(list),pending:fresh.length?{from:incoming.from,entries:fresh,removed:{}}:null}
}
export function acceptHandoff(pending:Handoff){
 let list=readList()
 for(const item of pending.entries)list=upsert(list,item)
 return writeList(list)
}
