import {ImportedRevisions} from './ImportedRevisions';
export type SlackPresentation = {
    source?: 'Mattermost' | 'Google Chat';
    links?:{url:string;href:string|null}[];
    pinned?:boolean;
    text: string;
    edited: boolean;
    missingFiles: { sourceId: string; name: string; size: number | null }[];
    reactions: { name: string; count: number; people: string[]; image?:string }[];
};
/** Source reactions have no native mutation controls or attention effects. */
export function SlackHistory({ history,messageId,accessEpoch,onDenied }: { history?: SlackPresentation;messageId?:string;accessEpoch?:number|string;onDenied?:()=>void }) {
    if (!history&&!messageId) return null;
    return <>{history?.pinned&&<span className="edited">Pinned in {history.source??'Slack'}</span>}{history?.edited && <span className="edited">edited in {history.source??'Slack'}</span>}
        {history?.links?.map((link,index)=><div key={index}>{link.href?<a href={link.href}>Open imported Slack thread</a>:<span>Slack message not imported or not available to you · {link.url}</span>}</div>)}
        {history?.missingFiles.map(f => <div className="file-row" key={f.sourceId}><span>file not supplied: {f.name}</span></div>)}
        {history&&history.reactions.length > 0 && <div className="team-reactions" aria-label={'Imported '+(history.source??'Slack')+' reactions · read only'}>{history.reactions.map((r, i) => <span key={i} title={r.people.join(', ')}>{r.image&&<img src={r.image} alt="" width="18" height="18"/>}{r.name} <span>{r.count}</span></span>)}</div>}
        {messageId&&accessEpoch!==undefined&&<ImportedRevisions messageId={messageId} accessEpoch={accessEpoch} onDenied={onDenied}/>}
    </>;
}
