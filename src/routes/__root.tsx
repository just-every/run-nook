import {introGuardScript,introCss} from '../base/hydration/intro-guard'
import {NavigationLifecycle} from '../editor/NavigationLifecycle'
import {useEditorLeafReady} from '../base/modules/editor/src/react'
import branding from '../branding.json'
import '../chat/accessibility.css'
import {fontLinks} from '../base/font-head'
import {NotFound} from '../NotFound'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: branding.name }, { charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }], links: [...fontLinks] }),
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
  component: () => <html lang="en"><head><script dangerouslySetInnerHTML={{__html:introGuardScript}} /><style>{introCss}</style><HeadContent /></head><body><Outlet /><NavigationLifecycle /><Scripts /></body></html>,
})

function ErrorPage(){useEditorLeafReady('error');return <h1>Unable to load this page</h1>}
