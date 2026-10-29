// Base's Lobby tells a signed-out owner on this computer to run `rer signin`; Nook's owner page has only the one button.
const recoveryLine='<p class="credit">Owners can also run <code>rer signin</code> from the project folder.</p>'
export async function withoutRecoveryLine(response:Response){
 if(!response.body||!response.headers.get('content-type')?.includes('text/html'))return response
 return new Response((await response.text()).replace(recoveryLine,''),{status:response.status,headers:response.headers})
}
