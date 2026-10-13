import {installCompiledLiveEdits,setLiveEditsReady} from '../base/modules/editor/src/index'
import compiled from './visual-edits.json'

// Imported by the router before hydration. One shared copied runtime for all leaves.
if(typeof document!=='undefined') {
 setLiveEditsReady(false)
 installCompiledLiveEdits(compiled)
}
export {setLiveEditsReady}
