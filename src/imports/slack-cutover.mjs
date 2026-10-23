import { actorLabel } from './slack-records.mjs';

export const cutoverRowLimit = 1000;
const address = /^[^\s@<>"'`,;]{1,64}@[^\s@<>"'`,;]{1,255}\.[^\s@<>"'`,;]{1,63}$/;
const flags = new Set(['workspace-owner', 'workspace-admin']);

/** Cutover-invitation preparation from a Slack export's `users.json`. A
 * proposal is never an owner or admin role: Workspace Owners and Admins are
 * only flagged, and `admin` exists only as the owner's saved choice. Deactivated
 * users and bots get no row (their history imports under the reviewed identity). */
export function cutoverInvitations({ users, channels, automationIds }) {
    const rows = [], counts = { members: 0, guests: 0, deactivated: 0, bots: 0, needsAddress: 0, workspaceAdmins: 0 };
    for (const user of [...users].sort((a, b) => a.id < b.id ? -1 : 1)) {
        if (automationIds.has(user.id) || user.id === 'USLACKBOT') { counts.bots++; continue; }
        if (user.deleted === true) { counts.deactivated++; continue; }
        const guest = user.is_restricted === true || user.is_ultra_restricted === true;
        const email = typeof user.profile?.email === 'string' ? user.profile.email.trim() : '';
        const adminFlag = guest ? null : user.is_primary_owner === true || user.is_owner === true ? 'workspace-owner' : user.is_admin === true ? 'workspace-admin' : null;
        const row = { sourceId: user.id, name: actorLabel(user), email: address.test(email) ? email : '', needsAddress: !address.test(email),
            proposed: guest ? 'guest' : 'member', adminFlag,
            channels: guest ? channels.filter(channel => Array.isArray(channel.sourceRecord?.members) && channel.sourceRecord.members.includes(user.id)).map(channel => channel.sourceId).sort() : [] };
        counts[guest ? 'guests' : 'members']++;
        if (row.needsAddress) counts.needsAddress++;
        if (adminFlag) counts.workspaceAdmins++;
        rows.push(row);
    }
    const listed = rows.slice(0, cutoverRowLimit);
    return { rows: listed, counts, notListed: rows.length - listed.length };
}

const fail = () => { throw Error('Invalid cutover invitation preparation'); };
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === names;
/** The reviewed packet is the owner's own upload: bound its shape so a stored
 * row can never carry a role, flag or channel the preparation does not define. */
export function validateCutover(value) {
    if (value === undefined) return;
    if (!keys(value, 'counts,notListed,rows') || !Array.isArray(value.rows) || value.rows.length > cutoverRowLimit
        || !Number.isSafeInteger(value.notListed) || value.notListed < 0 || !value.counts || typeof value.counts !== 'object') fail();
    const seen = new Set();
    for (const row of value.rows) {
        if (!keys(row, 'adminFlag,channels,email,name,needsAddress,proposed,sourceId') || typeof row.sourceId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(row.sourceId) || seen.has(row.sourceId)
            || typeof row.name !== 'string' || row.name.length > 400 || typeof row.email !== 'string' || row.email.length > 400 || typeof row.needsAddress !== 'boolean' || row.needsAddress !== !address.test(row.email)
            || !['member', 'guest'].includes(row.proposed) || row.adminFlag !== null && !flags.has(row.adminFlag) || row.adminFlag !== null && row.proposed !== 'member'
            || !Array.isArray(row.channels) || row.channels.length > 50 || row.channels.some(channel => typeof channel !== 'string') || row.proposed === 'member' && row.channels.length) fail();
        seen.add(row.sourceId);
    }
}

/** Only an explicit `admin` choice for a flagged row is stored; member is the default. */
export function validateCutoverChoices(rows, choices) {
    if (!choices || typeof choices !== 'object' || Array.isArray(choices) || Object.keys(choices).length > cutoverRowLimit) throw Error('Choose invitation roles from the previewed rows.');
    const flagged = new Map(rows.filter(row => row.adminFlag).map(row => [row.sourceId, row]));
    const admins = {};
    for (const [sourceId, role] of Object.entries(choices)) {
        if (!flagged.has(sourceId) || !['member', 'admin'].includes(role)) throw Error('Only a flagged Workspace Owner or Admin row can be invited as an admin.');
        if (role === 'admin') admins[sourceId] = 'admin';
    }
    return admins;
}
