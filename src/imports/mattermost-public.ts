/** Private source saves stay in owner custody and the assignee's collection.
 * Ordinary conversation members receive only the shared source metadata. */
export function publicMattermostRecord(record:any){
 if(record?.nookSource!=='mattermost')return record
 const {flagged_by,mappedSavedUsers,thread_followers,favorited_by,shown_by,...shared}=record
 return shared
}
