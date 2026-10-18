export type FileType=''|'image'|'pdf'|'text'|'other'
export type ListedFile={
 id:string;conversation:string;message:string;parent:string|null
 name:string;mime:string;size:number;created:string
 author:string|null;authorName:string;source:'native'|'imported'
}
export type FilesPage={items:ListedFile[];cursor:string;hasMore:boolean}
export type FilesFilters={conversation:string|null;person:string|null;type:FileType}
export type FilesPosition={stamp:number;id:string}
