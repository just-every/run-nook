export type RecentVisit={key:string;conversation?:string}
const storageKey=(user:string)=>'nook:recent:v2:'+encodeURIComponent(user)

// Persist identities only. Every label and permission is resolved again by the
// server when the switcher opens, including visits to now-unfollowed threads.
export function recentVisits(user:string):RecentVisit[]{
 const raw=localStorage.getItem(storageKey(user))
 if(raw===null)return []
 const value:unknown=JSON.parse(raw)
 if(!Array.isArray(value)||value.some(item=>!item||typeof item.key!=='string'||!/^[cpt]:.+$/.test(item.key)||item.conversation!==undefined&&typeof item.conversation!=='string'))throw Error('Recent navigation could not be read from this browser.')
 return value
}
export function recordVisit(user:string,visit:RecentVisit){
 const visits=recentVisits(user)
 localStorage.setItem(storageKey(user),JSON.stringify([visit,...visits.filter(item=>item.key!==visit.key)]))
}
