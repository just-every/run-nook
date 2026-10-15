import {devGate,DEV_KEY_HEADER} from '../base/modules/operator-auth/index.mjs';
import {hashToken,validToken} from '../base/modules/operator-auth/crypto.mjs';
import {readParameters} from '../base/modules/operator-auth/input.mjs';
import {pageResponse} from '../base/modules/operator-auth/page.mjs';

// A dev-issued invitation remains a dev credential. Explain the missing browser
// admission without granting it, consuming the link or exposing the checkout key.
// Loaded exclusively by server.dev.ts, after the Base dev layer has registered
// its admission guard and the ordinary auth handler has refused the preview.
export async function invitationKeyNotice(request,env,auth){
 const url=new URL(request.url);
 if(url.pathname!=='/auth/confirm'||!['GET','HEAD'].includes(request.method))return null;
 const gate=devGate({key:env.RER_DEV_KEY,origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true'});
 if(!gate||await gate.admits(request))return null;
 let token;
 try{token=readParameters(url.searchParams).token}catch{return null}
 if(!validToken(token))return null;
 const digest=await hashToken(env.SESSION_SECRET,'link',token);
 const marked=await env.DB.prepare("SELECT 1 FROM oa_tokens t JOIN oa_dev_credentials d ON d.credential='oa_tokens' AND d.id=t.id WHERE t.token_hash=? AND t.kind='invite'").bind(digest).first();
 if(!marked)return null;
 // Read-only preview repeats Base's expiry, revocation and current issuer checks.
 // The key is used only inside this server-side probe, never on a confirmation.
 const headers=new Headers(request.headers);headers.set(DEV_KEY_HEADER,env.RER_DEV_KEY);
 let preview;
 try{preview=await auth.previewLink(new Request(request,{headers}),token)}catch{return null}
 if(preview?.kind!=='invite')return null;
 return pageResponse({branding:auth.presentation,status:403,method:request.method,
  heading:'Open this browser for local development',
  content:'<p>This invitation was sent from a local development session. This browser profile needs the same checkout’s private dev key before it can accept the invitation.</p><p>Open the <strong>RER_OPEN</strong> link printed by <code>rer dev</code> in this browser profile, then reopen this invitation and press <strong>Confirm</strong>. If you no longer have that link, run <code>rer dev</code> again to print it.</p><p>The invitation has not been used. Keep the RER_OPEN link on this computer.</p>'});
}
