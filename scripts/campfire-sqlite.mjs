/** Emscripten's in-memory ASM build probes self.location before detecting Node.
 * Cloudflare has WorkerGlobalScope without location. Supply the embedded module
 * identity through Emscripten's existing __filename contract at bundle time; the ASM
 * engine reads the uploaded bytes and never loads a database or remote script. */
export function campfireSqlite(){
 return {name:'campfire-sqlite-module-url',enforce:'pre',transform(code,id){
  if(!/\/sql\.js\/dist\/sql-asm\.js$/.test(id))return null
  return {code:'const __filename="sql-asm.js";\n'+code,map:null}
 }}
}
