// These SQL predicates are composed by the normalized storage authority. They do
// not authenticate a request or introduce a second session implementation.
export const productAccess = (userSql:string) => `EXISTS(SELECT 1 FROM nook_access pa WHERE pa.user=${userSql} AND pa.active=1)`
export const fullMember = (userSql:string) => `EXISTS(SELECT 1 FROM nook_access pa WHERE pa.user=${userSql} AND pa.active=1 AND pa.mode='member')`
export const allowedGrant = (userSql:string,conversationSql:string) => `EXISTS(SELECT 1 FROM nook_access pa JOIN oa_operators po ON po.id=pa.user WHERE pa.user=${userSql} AND pa.active=1 AND po.status='active' AND (pa.mode='member' OR EXISTS(SELECT 1 FROM nook_guest_grants pg WHERE pg.user=pa.user AND pg.conversation=${conversationSql})))`
export const visibleIdentity = (viewerSql:string,targetSql:string) => `(${fullMember(viewerSql)} OR ${viewerSql}=${targetSql} OR EXISTS(SELECT 1 FROM nook_members vm JOIN nook_members tm ON tm.conversation=vm.conversation WHERE vm.user=${viewerSql} AND tm.user=${targetSql}))`
// A cancelled invitation leaves its operator row inactive, kept with a cancellation guard until the person accepts a later invitation. That row is no longer a person in the team.
export const cancelledInvitation = (operator:string) => `(${operator}.status='inactive' AND EXISTS(SELECT 1 FROM oa_invitation_cancellations ic WHERE ic.operator_id=${operator}.id))`
