export type Recurrence='none'|'daily'|'weekdays'|'weekly'|'monthly'
export type ScheduleTime={localAt:string;zone:string;recurrence:Recurrence;endDate:string|null}
export function validateScheduleTime(input:unknown):ScheduleTime
export function occurrenceAt(localAt:string,zone:string):number
export function nextOccurrence(localAt:string,recurrence:Recurrence,endDate:string|null):string|null
