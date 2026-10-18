import {MattermostWizard} from '../imports/MattermostWizard';
import {CampfireWizard} from '../imports/CampfireWizard';
import { createFileRoute } from '@tanstack/react-router';
import { useEditorLeafReady } from '../base/modules/editor/src/react';
import '../brand/tokens.css';
import '../imports/imports.css';
import { loadImports } from '../imports/load';
import { ImportWizard } from '../imports/ImportWizard';
export const Route = createFileRoute('/imports')({ validateSearch:(search:Record<string,unknown>)=>({source:search.source==='mattermost'?'mattermost':search.source==='campfire'?'campfire':'slack'}),loader: () => loadImports(), component: Page, errorComponent: Forbidden });
function Page() { const initial=Route.useLoaderData();return Route.useSearch().source==='mattermost'?<MattermostWizard initial={initial}/>:Route.useSearch().source==='campfire'?<CampfireWizard initial={initial}/>:<ImportWizard initial={initial}/>; }
// Only the workspace owner may import. Anyone else gets a plain explanation and a way back, not a bare error; any other failure keeps its plain heading.
// The styles are imported here too: the page chunk that normally brings them is not loaded when the loader fails.
function Forbidden({ error }: { error: unknown }) { useEditorLeafReady('error'); return <main className="imports-page"><h1>{/owner/i.test(error instanceof Error ? error.message : '') ? 'Only the workspace owner can import history' : 'Unable to load this page'}</h1><p><a href="/app">Back to conversations</a></p></main>; }
