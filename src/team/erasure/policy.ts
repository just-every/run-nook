/** Installation source choices. Body retention is snapshotted at admission; owner protection also governs continuation. */
export const memberMessageBodies = 'erase' as 'erase' | 'retain'
export const operatorChannelMessageErasure = true
export const protectEveryOwnerFromErasure = false

export function memberErasureDescriptionFor(choice:'erase'|'retain'){return choice === 'retain'
 ? 'Erase identity, sign-in access, message revisions and files, including DMs. Keep current message bodies as Former member; those bodies may still contain names and personal information. Authored outcomes keep only scope, version count and state.'
 : 'Erase identity, sign-in access, authored messages and files, including DMs. Authored outcomes keep only scope, version count and state.'}
export const memberErasureDescription=memberErasureDescriptionFor(memberMessageBodies)
export function canEraseChannelMessage(kind:string,mode:string|undefined,role:string|undefined){return operatorChannelMessageErasure&&kind!=='dm'&&mode!=='guest'&&['owner','admin'].includes(role??'')}
export function canEraseMember(actor:string,role:string,target:string,targetRole:string){return actor!==target&&(role==='owner'||targetRole==='member')&&(!protectEveryOwnerFromErasure||targetRole!=='owner')}

export const priorDeletionScope='Selected files, earlier authored file deletions and any already accepted deletion whose ownership is unavailable must all be verified absent.'
