import {fontHead} from '../base/font-head'
import {themeFrame} from '../base/theme-frame'
import {theme} from '../theme'
import {tokenHash} from './run'
// The "turn these off" link in every notification email works without a
// session. Opening it shows one button; the button turns the member's email
// notifications off. Mail scanners open links, so a GET never changes anything.
const escape=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!))
const headers={'cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff','x-robots-tag':'noindex'}
async function page(status:number,title:string,content:string){
 const frame=await themeFrame(theme)
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>${fontHead}${frame.head}</head><body><main>${frame.brand}<h1>${escape(title)}</h1>${content}</main></body></html>`,{status,headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; "+frame.policy}})
}
const manage='<p><a href="/app?view=you">Manage email settings</a> (sign-in required).</p>'
export async function unsubscribeRoute(env:{DB:D1Database},request:Request){
 const url=new URL(request.url)
 if(request.method!=='GET'&&request.method!=='POST')return new Response(null,{status:405,headers:{...headers,allow:'GET, POST'}})
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return page(403,'Request refused','<p>Open the link from the email again.</p>')
 const token=request.method==='POST'?new URLSearchParams(await request.text()).get('t'):url.searchParams.get('t')
 const row=token&&/^[0-9a-f]{64}$/.test(token)?await env.DB.prepare('SELECT user FROM nook_notify_queue WHERE token_hash=? LIMIT 1').bind(await tokenHash(token)).first<{user:string}>():null
 if(!row)return page(404,'This link has expired',`<p>It may be older than 30 days.</p>${manage}`)
 if(request.method==='GET')return page(200,'Turn off email notifications?',`<p>You will stop getting email about mentions, commitments and urgent requests. Nook itself is unchanged.</p><form method="post" action="/notify/off"><input type="hidden" name="t" value="${escape(token!)}"><button type="submit">Turn off these emails</button></form>${manage}`)
 const now=Date.now()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO nook_notify_preferences(user,mentions,urgent,urgent_quiet,updated) VALUES(?,0,0,0,?) ON CONFLICT(user) DO UPDATE SET mentions=0,urgent=0,urgent_quiet=0,updated=excluded.updated').bind(row.user,now),
  env.DB.prepare("UPDATE nook_notify_queue SET state='cancelled',error='turned-off',updated=? WHERE user=? AND state IN ('pending','retrying')").bind(now,row.user),
 ])
 return page(200,'Email notifications are off',`<p>Nook will not email you about mentions, commitments or urgent requests. You can turn them on again in your settings.</p>${manage}`)
}
