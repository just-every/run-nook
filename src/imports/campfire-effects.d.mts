import type {SourceBundle,ImportMapping} from './kit';
export const CAMPFIRE_MAPPING_VERSION:string;
export function campfireNativeId(namespace:string,kind:string,key:string):string;
export function campfireCaptureJobId(capture:any,upload:string):string;
export function assertCampfireFileSize(size:number):void;
export function campfireKitSource(capture:any,owner:string,upload:string,review:string):{source:SourceBundle;mapping:ImportMapping;domainJob:string};
