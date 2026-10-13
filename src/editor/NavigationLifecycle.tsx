import {useEffect} from 'react'
import {useRouter} from '@tanstack/react-router'
import {setLiveEditsReady} from './runtime'

/** Keep compiled edits paused while the real application router changes leaves. */
export function NavigationLifecycle(){
 const router=useRouter()
 useEffect(()=>router.subscribe('onBeforeNavigate',()=>setLiveEditsReady(false)),[router])
 return null
}
