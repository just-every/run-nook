import type {ClipCue} from './cues.mjs'
export type ClipPolicy={audience:'source-message';retention:'source-inherited';export:'source-inherited';erasure:'source-inherited';hold:'none'}
export type ClipTranscript={attachment:string;message:string;conversation:string;mime:string;version:number;created:string|null;actor:string|null;actorName:string|null;format:'typed'|'webvtt';language:string;source:'human'|'provider';cues:ClipCue[];policy:ClipPolicy;provider:{available:boolean;canRequest:boolean;host:string|null}}
export type ClipRevision={attachment:string;version:number;actor:string|null;actorName:string|null;created:string;format:'typed'|'webvtt';language:string;source:'human'|'provider';cues:ClipCue[]}
export type ClipHistory={items:ClipRevision[];cursor:number|null}
export type ProviderReason='cap-spent'|'provider-error'|'timeout'|'malformed'|'changed'|'unavailable'
export type ProviderResult={state:'created';transcript:ClipTranscript}|{state:'failed';reason:ProviderReason}
