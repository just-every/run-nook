export type SlackPresentation = {
    source?: 'Mattermost';
    pinned?:boolean;
    text: string;
    edited: boolean;
    missingFiles: { sourceId: string; name: string; size: number | null }[];
    reactions: { name: string; count: number; people: string[]; image?:string }[];
};
/** Source reactions have no native mutation controls or attention effects. */
export function SlackHistory({ history }: { history?: SlackPresentation }) {
    if (!history) return null;
    return <>{history.pinned&&<span className="edited">Pinned in Mattermost</span>}{history.edited && <span className="edited">edited in {history.source??'Slack'}</span>}
        {history.missingFiles.map(f => <div className="file-row" key={f.sourceId}><span>file not supplied: {f.name}</span></div>)}
        {history.reactions.length > 0 && <div className="team-reactions" aria-label={'Imported '+(history.source??'Slack')+' reactions · read only'}>{history.reactions.map((r, i) => <span key={i} title={r.people.join(', ')}>{r.image&&<img src={r.image} alt="" width="18" height="18"/>}{r.name} <span>{r.count}</span></span>)}</div>}
    </>;
}
