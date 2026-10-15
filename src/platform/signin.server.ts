import {createSignInHandler} from '../base/modules/operator-auth/signin/index.mjs'
import {operatorAuth,type Bindings} from './operator-auth.server'
import {fontDocumentResponse} from '../base/font-response'

// Base owns the form, login_hint validation, providers and return destinations.
// The product supplies its guide links and a message a Managed owner can act on.
export async function signInRoute(env:Bindings,request:Request){
 const response=await createSignInHandler(operatorAuth(env),{links:()=>[{href:'/docs',label:'Read the Nook guides'},{href:'/export',label:'Export your workspace'}]})(request)
 if(!response)return null
 const document=(await fontDocumentResponse(response))!
 if(request.method==='HEAD'||new URL(request.url).searchParams.get('notice')!=='mail_unavailable')return document
 return new HTMLRewriter().on('p.notice[role="alert"]',{element(element){element.setInnerContent("We couldn't send the email. Please try again.")}}).transform(document)
}
