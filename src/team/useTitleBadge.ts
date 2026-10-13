import {useEffect} from 'react'
// The only open-tab notice is the title count. All OS alerts use Web Push.
export function useTitleBadge(user:string|null,count:number,ready:boolean,title:string){
 useEffect(()=>{document.title=user&&ready&&count>0?`(${count}) ${title}`:title;return()=>{document.title=title}},[user,count,ready,title])
}
