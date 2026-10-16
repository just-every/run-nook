import {context,type StorageBindings} from './storage/context'
import {read} from './storage/read'
import {write} from './storage/commands'
import {imports} from './storage/imports'
import {upload,download,remove,recoverDeletes} from './storage/files'
import {connect} from './storage/live'
export type Bindings=StorageBindings
// Normal application paths only use authorized row-level repositories. Legacy
// documents are admitted exclusively by the paused offline conversion command.
export class Repository {
 constructor(private env:Bindings){}
 private authentication:Promise<Awaited<ReturnType<typeof context>>>|undefined
 // A Repository belongs to one request. Every data statement still fences the
 // current session and membership; only parsing the same session is shared.
 authenticated(headers:Headers){return this.authentication??=context(this.env,headers)}
 async session(headers:Headers){return read(await this.authenticated(headers),'me')}
 async read(headers:Headers,action:string,id='',input={}){return read(await this.authenticated(headers),action,id,input)}
 async write(headers:Headers,action:string,id:string,input:Record<string,any>){const c=await this.authenticated(headers),result=await write(c,action,id,input);await c.hint();if(action==='edit'&&input.delete)await recoverDeletes(this.env);return result}
 async imports(headers:Headers,action:string,id:string,input:any={}){return imports(await context(this.env,headers),action,id,input)}
 async upload(headers:Headers,id:string,input:Record<string,any>){return upload(await context(this.env,headers),id,input)}
 async download(headers:Headers,id:string){return download(await context(this.env,headers),id)}
 async deleteAttachment(headers:Headers,id:string){return remove(await context(this.env,headers),id)}
 async live(request:Request){return connect(await context(this.env,request.headers),request)}
}
