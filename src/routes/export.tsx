import {createFileRoute} from '@tanstack/react-router'
import {useEditorLeafReady} from '../base/modules/editor/src/react'
import {ExportScreen} from '../portability/ExportScreen'
export const Route=createFileRoute('/export')({head:()=>({meta:[{title:'Export workspace · Nook'}]}),component:Export})
function Export(){useEditorLeafReady('/export');return <ExportScreen/>}
