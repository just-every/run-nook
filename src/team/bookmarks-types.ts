export type Bookmark={id:string;kind:'link'|'file'|'folder';title:string;parent:string|null;position:number;created:number;url?:string;file?:{available:boolean;id?:string;name?:string;mime?:string;size?:number};addedBy:{id:string;name:string}|null}
export type BookmarkState={version:number;canManage:boolean;limit:number;items:Bookmark[]}
export const refusal='Only members who can post in this channel change its bookmarks.'
