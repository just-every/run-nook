import {useEditorLeafReady} from './base/modules/editor/src/react'
import {useEffect} from 'react'
import {NookFrame} from './brand/NookFrame'
export function NotFound(){
 useEditorLeafReady('not-found')
 useEffect(()=>{document.title='Page not found · Nook'},[])
 return <NookFrame id="not-found" label="Skip to page"><h1>That page is not here</h1><p className="frame-lead">The link may have changed. Your conversations are still in your workspace.</p><div className="frame-actions"><a className="frame-primary" href="/app">Go to workspace</a></div></NookFrame>
}
