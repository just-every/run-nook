const events:Record<string,string>={
 'session.started':'Signed in','session.revoked':'Revoked a session','membership.join':'Joined a channel or conversation','membership.leave':'Left a channel or conversation','membership.baseline':'Channel or conversation membership recorded','membership.access':'Changed workspace access','authority.role-status':'Changed a member’s role or status',
 'channel.created':'Created a conversation','channel.converted':'Converted a group conversation','invitation.cancelled':'Cancelled an invitation','post.admin-override':'Posted with admin permission',
 'policy.posting':'Changed posting permissions','policy.default-channels':'Changed default channels','policy.broadcast':'Changed channel mention permissions','policy.profile-fields':'Changed profile fields','policy.export':'Changed export permissions','policy.channels':'Changed channel permissions','policy.files':'Changed file permissions','policy.notifications':'Changed notification defaults','policy.notifications.adopt':'Applied notification defaults','policy.import-door':'Changed import access','policy.import-key-revoked':'Revoked an import key',
 'import.approved':'Approved an import','import.failed':'Import failed','import.withdrawn':'Withdrew an import plan','archive.import.complete':'Restored a backup','export.cancelled':'Cancelled an export','report.export':'Downloaded a report','bookmark.add':'Added a bookmark','bookmark.remove':'Removed a bookmark','bookmark.reorder':'Reordered bookmarks','forward.policy':'Changed forwarding permissions'
}
// A membership row names the kind of conversation it belongs to; the Kind filter spans both, so it names both.
const channel:Record<string,string>={'membership.join':'Joined a channel','membership.leave':'Left a channel','membership.baseline':'Channel membership recorded'}
const direct:Record<string,string>={'membership.join':'Joined a direct conversation','membership.leave':'Left a direct conversation','membership.baseline':'Direct conversation membership recorded'}
export function eventWords(kind:string,scopeKind?:string|null){const words=kind.replace(/[._-]+/g,' ');return (scopeKind&&(scopeKind==='dm'?direct:channel)[kind])||events[kind]||words.charAt(0).toUpperCase()+words.slice(1)}
export const eventKinds=Object.keys(events)
// The stored reason of a direct conversation's membership row says "Channel"; the row names its own kind.
export function reasonWords(reason:string,scopeKind?:string|null){return scopeKind==='dm'?reason.replace(/^Channel membership/,'Conversation membership'):reason}
// A membership fact has two people: the one who acted and the member it affected. A person joining or leaving on their
// own is one line as before; someone adding or removing another names both, and a fact with no acting person names the member.
type Membership={kind:string;actor:string|null;actorName:string;subject?:string|null;subjectName?:string|null;scope:string}
const changed:Record<string,string>={'membership.join':'added','membership.leave':'removed'}
export function auditHeadline(row:Membership&{scopeKind?:string|null}){
 if(row.subject&&row.actor&&row.subject!==row.actor&&changed[row.kind])return (row.scopeKind==='dm'?{'membership.join':'Added to a direct conversation','membership.leave':'Removed from a direct conversation'}:{'membership.join':'Added to a channel','membership.leave':'Removed from a channel'})[row.kind]!
 return eventWords(row.kind,row.scopeKind)
}
export function auditWho(row:Membership){
 if(!row.subject||!row.subjectName||row.subject===row.actor)return row.actorName
 if(!row.actor)return row.subjectName
 return changed[row.kind]?`${row.actorName} ${changed[row.kind]} ${row.subjectName}`:row.actorName
}
