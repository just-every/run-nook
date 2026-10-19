import type {ImportPlan} from './kit'
export function decodeSlackPlan(job:any,chunks:any[]):ImportPlan
export function slackArchivePlans(read:(table:string)=>Promise<any[]>,reviews:any[],db?:any):Promise<Map<string,any>>
