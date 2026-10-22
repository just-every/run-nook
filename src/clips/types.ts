import type {ClipCue} from './cues.mjs'
export type ClipPolicy={audience:'source-message';retention:'source-inherited';export:'source-inherited';erasure:'source-inherited';hold:'none'}
export type ClipTranscript={attachment:string;message:string;conversation:string;mime:string;version:number;created:string|null;actor:string|null;actorName:string|null;format:'typed'|'webvtt';language:string;cues:ClipCue[];policy:ClipPolicy}
export type ClipRevision={attachment:string;version:number;actor:string|null;actorName:string|null;created:string;format:'typed'|'webvtt';language:string;cues:ClipCue[]}
export type ClipHistory={items:ClipRevision[];cursor:number|null}
