import { Fault } from '../family/team-chat/fault.mjs';
import { occurrenceAt, nextOccurrence, validateScheduleTime } from '../scheduled/time.mjs';

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayMs = 86_400_000;
const fail = message => { throw new Fault(400, message); };
const pad = (value, width = 2) => String(value).padStart(width, '0');
const format = v => `${pad(v.year, 4)}-${pad(v.month)}-${pad(v.day)}T${pad(v.hour)}:${pad(v.minute)}`;

function calendarDate(v) {
    const date = new Date(0);
    date.setUTCFullYear(v.year, v.month - 1, v.day);
    date.setUTCHours(v.hour ?? 0, v.minute ?? 0, 0, 0);
    return date;
}

function moveDays(v, days) {
    const date = new Date(calendarDate(v).getTime() + days * dayMs);
    return { ...v, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function localClock(epoch, zone) {
    if (typeof zone !== 'string' || !zone.length || zone.length > 100 || /^[+-]/.test(zone))
        return fail('Choose an IANA time zone');
    let formatter;
    try {
        formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone, calendar: 'gregory', numberingSystem: 'latn',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        });
    } catch {
        return fail('Choose an IANA time zone');
    }
    const local = Object.fromEntries(formatter.formatToParts(epoch)
        .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    return { local, zone: formatter.resolvedOptions().timeZone };
}

function clock(value) {
    const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value);
    if (!match) return fail('Use a time such as 9am, 3:30pm or 15:30');
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23 || !match[2]))
        return fail('Use a valid time with am/pm or a 24-hour time such as 15:30');
    if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
    return { hour, minute };
}

function quoted(value) {
    const quote = value[0];
    let text = '';
    for (let index = 1; index < value.length; index++) {
        const character = value[index];
        if (character === quote) return { text, rest: value.slice(index + 1).trim() };
        if (character === '\\') {
            const next = value[++index];
            if (next !== quote && next !== '\\') return fail('Escape only quotes or backslashes inside quoted reminder text');
            text += next;
        } else text += character;
    }
    return fail('Close the quoted reminder text');
}

function separateText(value) {
    if (/^["']/.test(value)) {
        const { text, rest } = quoted(value);
        return { text, time: rest };
    }
    const delimiter = /\s+to\s+/i.exec(value);
    // Quoted text may follow the complete time expression as well as precede it.
    const start = /\s+["']/.exec(value);
    if (start && (!delimiter || start.index < delimiter.index)) {
        const { text, rest } = quoted(value.slice(start.index).trim());
        if (rest) return fail('Put the complete time before or after the quoted reminder text');
        return { text, time: value.slice(0, start.index) };
    }
    if (delimiter) return { time: value.slice(0, delimiter.index), text: value.slice(delimiter.index + delimiter[0].length), loose: true };
    return null;
}

// Plain words: the reminder is its text followed by when, as in "Water the basil tomorrow at 9am". The earliest split
// whose tail reads as a time wins, so the longest time expression is taken.
function trailingTime(value, readTime) {
    const words = value.split(/\s+/);
    for (let index = 1; index < words.length; index++) {
        const time = words.slice(index).join(' ');
        try { readTime(time); } catch (error) { if (error instanceof Fault) continue; throw error; }
        return { text: words.slice(0, index).join(' '), time };
    }
    return fail('Say when, for example: Water the basil tomorrow at 9am');
}

function ordinal(value) {
    const match = /^(\d{1,2})(st|nd|rd|th)?$/.exec(value);
    if (!match) return fail('Choose a calendar day from 1 to 31');
    const day = Number(match[1]);
    const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th');
    if (day < 1 || day > 31 || (match[2] && match[2] !== suffix)) return fail('Choose a valid calendar day, such as the 1st or 20th');
    return day;
}

function namedDate(expression, local, time, zone, now) {
    const match = /^on\s+([a-z]+)\s*(\d{1,2}(?:st|nd|rd|th)?)(?:,?\s+(\d{4}))?$/.exec(expression);
    if (!match || !months.includes(match[1])) return null;
    let year = match[3] ? Number(match[3]) : local.year;
    const month = months.indexOf(match[1]) + 1, day = ordinal(match[2]);
    // Validate the month/day independently of this year, so February 29 can
    // select the next leap year but February 30 is always refused.
    const check = calendarDate({ year: 2000, month, day });
    if (check.getUTCMonth() + 1 !== month) return fail('Choose a valid calendar date');
    for (; year <= 9998; year++) {
        const value = { year, month, day, ...time }, date = calendarDate(value);
        if (date.getUTCMonth() + 1 !== month) {
            if (match[3]) return fail('Choose a valid calendar date');
            continue;
        }
        const localAt = format(value);
        if (match[3] || occurrenceAt(localAt, zone) > now) return localAt;
    }
    return fail('Choose a future date before year 9999');
}

function parseTime(expression, local, zone, now) {
    const value = expression.trim().toLowerCase().replace(/\s+/g, ' ');
    const relative = /^in\s+(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks)$/.exec(value);
    if (relative) {
        const amount = Number(relative[1]);
        if (!Number.isSafeInteger(amount) || amount < 1) return fail('Choose a positive whole number of minutes, hours, days or weeks');
        const unit = relative[2].replace(/s$/, '');
        if (unit === 'minute' || unit === 'hour') {
            const due = now + amount * (unit === 'minute' ? 60_000 : 3_600_000);
            if (!Number.isSafeInteger(due) || due >= calendarDate({ year: 9999, month: 1, day: 1 }).getTime())
                return fail('Choose a future date before year 9999');
            return { localAt: format(localClock(due, zone).local), recurrence: 'none', due };
        }
        const localAt = format(moveDays(local, amount * (unit === 'week' ? 7 : 1)));
        return { localAt, recurrence: 'none' };
    }

    const at = /^(.*?)\bat\s*(.+)$/.exec(value);
    const expressionDate = at ? at[1].trim() : value;
    // Date-only phrases have a visible, fixed 9am wall-clock time in preview.
    const time = at ? clock(at[2]) : { hour: 9, minute: 0 };
    let start = { ...local, ...time }, recurrence = 'none';
    if (expressionDate === '' && at) {
        if (occurrenceAt(format(start), zone) <= now) start = moveDays(start, 1);
    } else if (expressionDate === 'today' || expressionDate === 'tomorrow') {
        start = moveDays(start, expressionDate === 'tomorrow' ? 1 : 0);
    } else if (/^next\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.test(expressionDate)) {
        const day = weekdays.indexOf(expressionDate.replace(/^next\s*/, ''));
        start = moveDays(start, (day - calendarDate(start).getUTCDay() + 7) % 7 || 7);
    } else if (/^every\s*(day|weekday|weekdays|sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.test(expressionDate)) {
        const frequency = expressionDate.replace(/^every\s*/, '');
        if (frequency === 'day') recurrence = 'daily';
        else if (frequency === 'weekday' || frequency === 'weekdays') {
            recurrence = 'weekdays';
            while ([0, 6].includes(calendarDate(start).getUTCDay())) start = moveDays(start, 1);
        } else {
            recurrence = 'weekly';
            start = moveDays(start, (weekdays.indexOf(frequency) - calendarDate(start).getUTCDay() + 7) % 7);
        }
    } else if (/^every\s+month\s+on\s+(?:the\s*)?\d{1,2}(?:st|nd|rd|th)?$/.test(expressionDate)) {
        recurrence = 'monthly';
        start.day = ordinal(expressionDate.replace(/^every\s+month\s+on\s+(?:the\s*)?/, ''));
        // A 31st reminder skips months lacking a 31st, like the scheduler.
        while (calendarDate(start).getUTCMonth() + 1 !== start.month) {
            start.month++;
            if (start.month > 12) { start.month = 1; start.year++; }
        }
    } else {
        const localAt = namedDate(expressionDate, local, time, zone, now);
        if (!localAt) return fail('Could not understand the reminder time. Try “in 20 minutes”, “tomorrow at 9am”, “on October 20” or “every weekday at 9am”');
        return { localAt, recurrence };
    }
    let localAt = format(start);
    if (recurrence !== 'none' && occurrenceAt(localAt, zone) <= now)
        localAt = nextOccurrence(localAt, recurrence, null);
    if (!localAt) return fail('Choose a future date before year 9999');
    return { localAt, recurrence };
}

/** Parse a bounded, explicit reminder grammar; never infer unknown phrases.
 * A phrase that names no one is a reminder for me. Date-only phrases use 09:00. A bare clock rolls to tomorrow when
 * needed; a named date without a year chooses its next future occurrence. */
export function parseReminder(phrase, zone, now = Date.now()) {
    if (typeof phrase !== 'string' || !phrase.trim()) return fail('Enter a reminder with a time and text');
    if (typeof now !== 'number' || !Number.isFinite(now) || Math.abs(now) > 8.64e15) return fail('Choose a valid current time');
    const input = phrase.trim().replace(/^\/remind\s+/i, '');
    const match = /^(me|[@#][\p{L}\p{N}_.-]+)\s+(.+)$/isu.exec(input);
    const target = match ? (match[1].toLowerCase() === 'me' ? 'me' : match[1]) : 'me';
    const rest = match ? match[2].trim() : input;
    const read = time => { const current = localClock(now, zone); return parseTime(time, current.local, current.zone, now); };
    let split = separateText(rest), refused = null;
    // “to” may be a word of the text itself (“Go to the shop tomorrow at 9am”), so a tail that is no time is read as plain words.
    if (split?.loose) try { read(split.time); } catch (error) { if (!(error instanceof Fault)) throw error; refused = error; split = null; }
    if (!split) try { split = trailingTime(rest, read); } catch (error) { throw refused ?? error; }
    const { time, text } = split;
    if (!text.trim()) return fail('Add some reminder text');
    if (!time.trim()) return fail('Add a reminder time');
    const current = localClock(now, zone);
    const parsed = parseTime(time, current.local, current.zone, now);
    const schedule = validateScheduleTime({ ...parsed, zone: current.zone, endDate: null });
    const due = parsed.due ?? occurrenceAt(schedule.localAt, schedule.zone);
    if (due <= now) return fail('Choose a future reminder time');
    return { target, text: text.trim(), ...schedule, endDate: null, due };
}
