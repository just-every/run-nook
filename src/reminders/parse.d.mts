import type { Recurrence } from '../scheduled/time.mjs';

export type ParsedReminder = {
    target: string;
    text: string;
    localAt: string;
    zone: string;
    recurrence: Recurrence;
    endDate: null;
    due: number;
};

/** Date-only phrases use 09:00 in the supplied zone. */
export function parseReminder(phrase: string, zone: string, now?: number): ParsedReminder;
