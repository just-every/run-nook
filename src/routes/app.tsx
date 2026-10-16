import {useEditorLeafReady} from '../base/modules/editor/src/react'
import { createFileRoute } from '@tanstack/react-router'
import { loadWorkspace } from '../loaders'
import { ChatScreen } from '../ChatScreen'
export const Route = createFileRoute('/app')({loader:()=>loadWorkspace(),shouldReload:({cause})=>cause==='enter',component: App})
function App() { useEditorLeafReady('/app'); return <ChatScreen initial={Route.useLoaderData()} /> }
