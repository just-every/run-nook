import type {Context} from '../platform/storage/context';
export async function gchatPresentation(c:Context,row:any,source:any){
 const reactions=source.reactions??[],ids=[...new Set<string>(reactions.flatMap((r:any)=>r.users))];
 const actors=ids.length?await c.rows('SELECT source_id,source_record FROM nook_import_actors WHERE job=? AND source_id IN (SELECT value FROM json_each(?))',[row.job,JSON.stringify(ids)],row.conversation):[];
 const names=new Map(actors.map(a=>[a.source_id,JSON.parse(a.source_record).name]));
 return {source:'Google Chat' as const,text:row.body,edited:!!source.edited,missingFiles:[],reactions:reactions.map((r:any)=>({name:r.name,count:r.count,people:r.users.map((id:string)=>names.get(id)??id)}))};
}
