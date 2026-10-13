import {useEditorLeafReady} from '../base/modules/editor/src/react'
import { createFileRoute } from '@tanstack/react-router'
import { SignInScreen } from '../SignInScreen'
import {loadSignInConfiguration} from '../loaders'
import {useEffect} from 'react'
import {clearPushNotices} from '../push/notices'
export const Route = createFileRoute('/signin')({loader:()=>loadSignInConfiguration(),head:()=>({meta:[{title:'Sign in · Nook'}]}),component:SignIn})
function SignIn(){useEditorLeafReady('/signin');useEffect(()=>{void clearPushNotices()},[]);return <SignInScreen {...Route.useLoaderData()} />}
