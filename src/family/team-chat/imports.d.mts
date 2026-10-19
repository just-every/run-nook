import type {State,Identity} from "./domain"
export function importedBytes(s:State):number
export function importedHistory(s:State,u:Identity,id:string,input?:any):any
export function searchImportedHistory(s:State,u:Identity,q:any):any
export function importedFile(s:State,u:Identity,id:string):any
