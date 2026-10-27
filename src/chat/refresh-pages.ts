// Refresh every page the person has opened, so a live hint never truncates
// their list or removes the rows holding their scroll position.
export async function refreshPages<T extends {items:unknown[];hasMore:boolean;cursor:string}>(read:(after?:string)=>Promise<T>,count:number):Promise<T>{
 let page=await read(),items=page.items
 for(let index=1;index<count&&page.hasMore&&page.cursor;index++){
  page=await read(page.cursor);items=[...items,...page.items]
 }
 return {...page,items}
}
