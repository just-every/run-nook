import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {settings} from './settings.server'
import {providerTranscript} from './request.server'
/** /api/transcripts/settings (owner) and POST /api/clips/:attachment/provider-transcript (the clip's author, owners and admins). Agents never reach either. */
export async function transcriptRoute(c:Context,method:string,p:string[],input:Record<string,unknown>,agent:boolean){
 const settingsDoor=p[1]==='transcripts'&&p.length===3&&p[2]==='settings',requestDoor=p[1]==='clips'&&p.length===4&&p[3]==='provider-transcript'&&method==='POST'
 if(!settingsDoor&&!requestDoor)return null
 if(agent)fail(403,'Provider transcripts are not available to agents')
 return settingsDoor?settings(c,method,input):providerTranscript(c,p[2],input)
}
