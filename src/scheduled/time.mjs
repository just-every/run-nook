import { Fault } from '../family/team-chat/fault.mjs';
const fail = (status, message) => { throw new Fault(status, message); };
const recurrences = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];
const dayMs = 86_400_000;
function utc(v) { const d = new Date(0); d.setUTCFullYear(v.year, v.month - 1, v.day); d.setUTCHours(v.hour, v.minute, 0, 0); return d.getTime(); }
function parseLocal(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        return fail(400, 'Choose a local date and time in YYYY-MM-DDTHH:mm format');
    const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number), v = { year, month, day, hour, minute }, d = new Date(utc(v));
    if (year < 1 || year > 9998 || d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day || d.getUTCHours() !== hour || d.getUTCMinutes() !== minute)
        return fail(400, 'Choose a valid local date and time');
    return v;
}
function formatter(zone) {
    if (typeof zone !== 'string' || !zone.length || zone.length > 100 || /^[+-]/.test(zone))
        return fail(400, 'Choose an IANA time zone');
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    }
    catch {
        return fail(400, 'Choose an IANA time zone');
    }
}
function pad(n, width = 2) { return String(n).padStart(width, '0'); }
function format(v) { return `${pad(v.year, 4)}-${pad(v.month)}-${pad(v.day)}T${pad(v.hour)}:${pad(v.minute)}`; }
function fromEpoch(epoch) { const d = new Date(epoch); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }; }
function zoneLocal(epoch, f) {
    const p = Object.fromEntries(f.formatToParts(epoch).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    return utc({ year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute }) + p.second * 1000;
}
/** Earlier instant in an overlap; advance by the transition gap when local time
 * does not exist. The stored local time remains the recurrence's wall clock. */
export function occurrenceAt(localAt, zone) {
    const target = utc(parseLocal(localAt)), f = formatter(zone), offsets = new Set();
    // Both sides of even a full-day date-line transition are sampled. Candidate
    // offsets are verified against the zone rather than assumed to be whole hours.
    for (let delta = -2 * dayMs; delta <= 2 * dayMs; delta += 6 * 3_600_000) {
        const sample = target + delta;
        offsets.add(zoneLocal(sample, f) - sample);
    }
    const candidates = [...offsets].map(offset => { const epoch = target - offset; return { epoch, local: zoneLocal(epoch, f) }; });
    const exact = candidates.filter(c => c.local === target).sort((a, b) => a.epoch - b.epoch);
    if (exact.length)
        return exact[0].epoch;
    const advanced = candidates.filter(c => c.local > target).sort((a, b) => a.local - b.local || a.epoch - b.epoch);
    if (!advanced.length)
        return fail(400, 'The chosen local time cannot be resolved in this time zone');
    return advanced[0].epoch;
}
/** Structural validation only: the caller checks future time and its rolling
 * one-year scheduling horizon using occurrenceAt and the current clock. */
export function validateScheduleTime(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return fail(400, 'Schedule time is required');
    const data = input, localAt = format(parseLocal(data.localAt)), zone = formatter(data.zone).resolvedOptions().timeZone;
    const recurrence = data.recurrence === undefined ? 'none' : data.recurrence;
    if (!recurrences.includes(recurrence))
        return fail(400, 'Choose none, daily, weekdays, weekly or monthly recurrence');
    if (recurrence === 'weekdays' && [0, 6].includes(new Date(utc(parseLocal(localAt))).getUTCDay()))
        return fail(400, 'Choose a weekday for the first weekday prompt');
    const endDate = data.endDate === undefined ? null : data.endDate;
    if (endDate !== null) {
        if (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
            return fail(400, 'Choose an end date in YYYY-MM-DD format');
        parseLocal(endDate + 'T00:00');
        const start = parseLocal(localAt), end = utc(parseLocal(endDate + 'T00:00'));
        // A calendar year, clamping a leap-day anniversary to February's last day.
        const anniversary = { ...start, year: start.year + 1, hour: 0, minute: 0 };
        let limit = utc(anniversary);
        if (new Date(limit).getUTCMonth() + 1 !== anniversary.month)
            limit -= dayMs;
        if (endDate < localAt.slice(0, 10) || end > limit)
            return fail(400, 'Choose an end date from the first occurrence through one year later');
    }
    return { localAt, zone, recurrence: recurrence, endDate: endDate };
}
/** Monthly recurrence skips months without the requested day: January 31 goes
 * to March 31. End date is inclusive in the schedule's own local calendar. */
export function nextOccurrence(localAt, recurrence, endDate) {
    const local = parseLocal(localAt);
    if (!recurrences.includes(recurrence))
        return fail(400, 'Invalid recurrence');
    if (endDate !== null)
        parseLocal(endDate + 'T00:00');
    if (recurrence === 'none')
        return null;
    let next;
    if (recurrence === 'monthly') {
        let month = local.month, year = local.year;
        do {
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
            next = { ...local, year, month };
        } while (new Date(utc(next)).getUTCMonth() + 1 !== month);
    }
    else {
        let epoch = utc(local) + (recurrence === 'weekly' ? 7 : 1) * dayMs;
        if (recurrence === 'weekdays')
            while ([0, 6].includes(new Date(epoch).getUTCDay()))
                epoch += dayMs;
        next = fromEpoch(epoch);
    }
    if (next.year > 9998)
        return null;
    const result = format(next);
    return endDate !== null && result.slice(0, 10) > endDate ? null : result;
}
