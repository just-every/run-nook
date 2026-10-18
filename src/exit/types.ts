export const FORMAT = 'nook.readable-export' as const
export const FORMAT_VERSION = 1 as const
export type ExportRecord = {type:string;conversation:string;data:Record<string,any>}
export type ExportCursor = {dataset:number;after:string}
export type ExportPage = {format:typeof FORMAT;version:typeof FORMAT_VERSION;job:string;ordinal:number;records:ExportRecord[]}
export type ExportJob = {
 id:string;owner:string;scope:'permitted'|'conversation';created:string;state:'running'|'cancelled'|'complete';
 workspace_policy_version:number|null;identity_revision:number;cursor_json:string;pages:number;records:number;files:number;bytes:number;omissions:number;
 counts_json:string;revision:number
}
export type ExportReport = {
 format:typeof FORMAT;version:typeof FORMAT_VERSION;id:string;scope:ExportJob['scope']|'workspace';created:string;
 state:ExportJob['state']|'invalidated'|'unavailable';pages:number;records:number;files:number;bytes:number;
 workspacePolicyVersion?:number;sourceOmissions:number;counts:Record<string,number>;complete:boolean;omissions:{code:string;reason:string}[];
 custody:string;pageIndex?:{ordinal:number;sha256:string;records:number}[]
}
export type ExportBundle = {format:typeof FORMAT;version:typeof FORMAT_VERSION;report:ExportReport;records:ExportRecord[];files:{id:string;sha256:string;size:number;base64:string}[]}
