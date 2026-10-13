/** Keep retry rejection without retaining a caller-supplied intent's text.
 * This is product idempotency, independent of Base's restore journal. */
export async function erasedIntent(author,intent,conversation=''){
 const bytes=new TextEncoder().encode(JSON.stringify([author,conversation,intent]));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
