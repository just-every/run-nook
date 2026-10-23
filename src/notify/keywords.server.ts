import {fail} from '../family/team-chat/domain'
import {searchFold,searchWords} from '../search/terms'
import type {Context} from '../platform/storage/context'

export const KEYWORD_LIMIT=20,KEYWORD_LENGTH=64
export function keywordText(value:unknown){
 const text=typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' '):''
 if(!text||text.length>KEYWORD_LENGTH||!searchWords(text).length)fail(400,`A keyword is a word or phrase of at most ${KEYWORD_LENGTH} characters`)
 return text
}
export async function keywordList(c:Context){return (await c.rows('SELECT keyword FROM nook_keywords WHERE user=? ORDER BY created,keyword',[c.uid])).map((row:any)=>row.keyword as string)}
/** Replace the member's whole list; case-insensitive duplicates collapse. */
export function keywordStatements(c:Context,list:unknown){
 if(!Array.isArray(list)||list.length>KEYWORD_LIMIT)fail(400,`Keep at most ${KEYWORD_LIMIT} keywords`)
 const seen=new Map<string,string>();for(const item of list as unknown[]){const text=keywordText(item);if(!seen.has(searchFold(text)))seen.set(searchFold(text),text)}
 const now=Date.now()
 return [c.sql('DELETE FROM nook_keywords WHERE user=?',c.uid),...[...seen].map(([folded,text],i)=>c.sql('INSERT INTO nook_keywords(user,folded,keyword,created) VALUES(?,?,?,?)',c.uid,folded,text,now+i))]
}
/** NOOK-019's Unicode tokenization: whole words, and a phrase is consecutive words. */
export function containsKeyword(body:string,keyword:string){
 const words=searchWords(body),phrase=searchWords(keyword)
 if(!phrase.length)return false
 for(let at=0;at+phrase.length<=words.length;at++)if(phrase.every((word,i)=>words[at+i]===word))return true
 return false
}
/** Members of the conversation, other than its author, whose keywords the new message contains. Reading rights are rechecked by the attention write itself. */
export async function keywordUsers(db:{prepare:(sql:string)=>any},conversation:string,body:string,author:string){
 const rows=(await db.prepare('SELECT k.user,k.keyword FROM nook_keywords k JOIN nook_members m ON m.user=k.user AND m.conversation=? WHERE k.user<>?').bind(conversation,author).all()).results as {user:string;keyword:string}[]
 return [...new Set(rows.filter(row=>containsKeyword(body,row.keyword)).map(row=>row.user))]
}
