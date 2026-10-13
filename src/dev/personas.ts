import type {DevPersona} from '../base/modules/operator-auth/dev/index.mjs'

// Nook's real roles. The owner is the person `rer setup` claimed; these are the others, real
// operators at <as>@dev.localhost created only by local dev sign-in and suspended in exports.
// `guest` is a member-role operator admitted as a guest (see admit.server.ts).
export const devPersonas=():DevPersona[]=>[
 {as:'admin',role:'admin',displayName:'Dev admin'},
 {as:'member',role:'member',displayName:'Dev member'},
 {as:'guest',role:'member',displayName:'Dev guest'},
]
