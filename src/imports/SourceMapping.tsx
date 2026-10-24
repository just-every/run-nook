import { MappingForm } from './MappingForm';
import type { ImportSource } from './door-client';

export function SourceMapping({ kind, source, review, onChange, busy }: {
    kind: ImportSource; source: any; review: any; onChange: (review: any) => void; busy: boolean;
}) {
    if (kind === 'slack' || kind === 'gchat') return <fieldset disabled={busy}><MappingForm source={source} review={review} setReview={onChange} /></fieldset>;
    const mattermost = kind === 'mattermost';
    const label = (id: string) => source.actors.find((actor: any) => actor.sourceId === id)?.label ?? id;
    return <fieldset disabled={busy}>
        <p>Source: {source.source.implementation} {source.source.version} · format {source.source.format}. {mattermost
            ? 'Every exported channel is included with its team name. Private channels, DMs and groups keep their mapped participant sets; the importing owner receives no extra membership.'
            : 'Every room is included. Closed rooms and DMs keep their mapped participant sets; the importing owner receives no extra membership.'}</p>
        <label>Source namespace<input required pattern={'[A-Za-z0-9_.\\-]{1,128}'} value={review.namespace} onChange={event => onChange({ ...review, namespace: event.target.value })} placeholder={`${kind}-team`} /></label>
        {source.actors.map((actor: any) => <label key={actor.sourceId}>{actor.label} · {mattermost ? actor.required ? 'participant or saved-item owner' : 'historical author' : actor.participant ? 'room participant' : 'historical author'}
            <select aria-label={`Map ${actor.label}`} required={actor.required || actor.participant} value={review.actors[actor.sourceId] ?? ''} onChange={event => onChange({ ...review, actors: { ...review.actors, [actor.sourceId]: event.target.value || null } })}>
                <option value="">{actor.required || actor.participant ? 'Choose an existing full member' : 'Keep as an external historical author'}</option>
                {source.users.filter((user: any) => user.active && user.mode === 'member').map((user: any) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
            </select>
        </label>)}
        {mattermost && <fieldset><legend>Source roles</legend><p>Source permissions never become Nook roles. Review each role as a historical label; an imported system administrator receives no custodian rights.</p>
            <button type="button" onClick={() => onChange({ ...review, roles: Object.fromEntries(source.roleInventory.map((role: string) => [role, 'historical-only'])) })}>Retain all source roles as historical labels</button>
            {source.roleInventory.map((role: string) => <label key={role}>Source role {role}<select required aria-label={`Role ${role}`} value={review.roles[role] ?? ''} onChange={event => onChange({ ...review, roles: { ...review.roles, [role]: event.target.value } })}><option value="">Choose how this source role is retained</option><option value="historical-only">Historical label only; no Nook privileges</option></select></label>)}
        </fieldset>}
        <ul>{source.channels.map((room: any) => <li key={room.sourceId}><strong>{room.name}</strong> · {room.kind} · {room.sourceMembers.map(label).join(', ')}{mattermost && <> · Nook manager: {label(room.sourceCreator)}</>}</li>)}</ul>
    </fieldset>;
}

export function mappingReady(kind: ImportSource, source: any, review: any) {
    if (!review.namespace) return false;
    if (kind === 'slack' || kind === 'gchat') return review.channels.length > 0 && source.actors.every((actor: any) => Object.hasOwn(review.actors, actor.sourceId));
    return source.actors.every((actor: any) => !(actor.required || actor.participant) || review.actors[actor.sourceId])
        && (kind !== 'mattermost' || source.roleInventory.every((role: string) => review.roles[role] === 'historical-only'));
}
