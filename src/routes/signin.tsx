import {useEditorLeafReady} from '../base/modules/editor/src/react'
import { createFileRoute } from '@tanstack/react-router'
import { SignInScreen } from '../SignInScreen'
import {loadSignInConfiguration} from '../loaders'
export const Route = createFileRoute('/signin')({loader:()=>loadSignInConfiguration(),head:()=>({meta:[{title:'Sign in · Nook'}]}),component:SignIn})
function SignIn(){useEditorLeafReady('/signin');return <SignInScreen {...Route.useLoaderData()} />}
