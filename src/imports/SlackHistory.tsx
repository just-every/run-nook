export type SlackPresentation = {
    text: string;
    edited: boolean;
    missingFiles: { sourceId: string; name: string; size: number | null }[];
    reactions: { name: string; count: number; people: string[] }[];
};
/** Source reactions have no native mutation controls or attention effects. */
export function SlackHistory({ history }: { history?: SlackPresentation }) {
    if (!history) return null;
    return <>{history.edited && <span className="edited">edited in Slack</span>}
        {history.missingFiles.map(f => <div className="file-row" key={f.sourceId}><span>file not supplied: {f.name}</span></div>)}
        {history.reactions.length > 0 && <div className="team-reactions" aria-label="Imported Slack reactions · read only">{history.reactions.map((r, i) => <span key={i} title={r.people.join(', ')}>{r.name} {r.count}</span>)}</div>}
    </>;
}
