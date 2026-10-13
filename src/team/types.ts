export type TeamRequest = <T=any>(path:string,init?:RequestInit)=>Promise<T>
export type ChannelChoice={id:string;name:string;kind:string}
export type Reaction={emoji:string;mine:boolean;count:number;cursor:string|null;actors:{id:string;name:string}[]}
export type AttentionNotice={id:string;conversation:string;reason:string;state:string;created:string;message?:{author?:string}|null}
