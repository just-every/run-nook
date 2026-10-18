export function sourceKind(upload:any):'campfire'|'slack'|'mattermost';
export function mappingVersion(review:any):string;
export function inspectSource(bytes:Uint8Array,kind:string,users:any[]):Promise<any>|any;
export function captureSource(inspected:any,review:any,owner:string,users:any[]):any;
export function publicCampfire(inspected:any,users:any[]):any;
export function summaryCampfire(capture:any):any;
export function assertImportEffect(kind:string,value:any):void;
export function sourceMessageFiles(record:any):any[];

export function campfireFileHashes(capture:any):any[];

export function publicMattermostInspection(inspected:any,users:any[]):any;
export function mattermostSummary(capture:any):any;
export function mattermostFileHashes(capture:any):any[];
