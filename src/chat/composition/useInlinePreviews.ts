import {useEffect,useState} from 'react'
export function useInlinePreviews(user:string,conversation:string){
 const [visible,setVisible]=useState(true)
 useEffect(()=>{
  const update=()=>{try{setVisible(localStorage.getItem(`nook:previews:${window.location.origin}:${user}:${conversation}`)!=='hidden')}catch{setVisible(true)}}
  update();window.addEventListener('nook:previews',update);window.addEventListener('storage',update)
  return()=>{window.removeEventListener('nook:previews',update);window.removeEventListener('storage',update)}
 },[user,conversation])
 return visible
}
