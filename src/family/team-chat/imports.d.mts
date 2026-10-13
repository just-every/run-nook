import type {State,Identity} from "./domain"
export function importedBytes(s:State):number
export function importPlan(s:State,u:Identity,capture:any):any
export function applyImport(s:State,u:Identity,input:any):any
export function importedHistory(s:State,u:Identity,id:string,input?:any):any
export function searchImportedHistory(s:State,u:Identity,q:any):any
export function importedFile(s:State,u:Identity,id:string):any
