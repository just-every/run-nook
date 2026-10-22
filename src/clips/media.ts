// Keep upload validation, the ordinary native file door and archive MIME
// admission aligned with these types. Codec parameters are capture-only.
export const CLIP_MIMES=['audio/webm','video/webm','audio/mp4','video/mp4','audio/ogg','audio/mpeg','audio/wav'] as const
export const MAX_CLIP_BYTES=25*1024*1024
export function isClipMime(mime:string){return (CLIP_MIMES as readonly string[]).includes(mime)}
export function clipExtension(mime:string){return ({'audio/webm':'webm','video/webm':'webm','audio/mp4':'m4a','video/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav'} as Record<string,string>)[mime]}
export function clipFile(file:File){
 const aliases:Record<string,string>={'audio/x-wav':'audio/wav','audio/wave':'audio/wav','audio/x-m4a':'audio/mp4','audio/mp3':'audio/mpeg'}
 const extensions:Record<string,string>={webm:'video/webm',mp4:'video/mp4',m4a:'audio/mp4',ogg:'audio/ogg',mp3:'audio/mpeg',wav:'audio/wav'}
 const mime=aliases[file.type]??(file.type||extensions[file.name.split('.').at(-1)?.toLowerCase()??''])
 if(!isClipMime(mime))throw Error('Choose WebM, MP4/M4A, Ogg audio, MP3 or WAV.');
 if(file.size<1||file.size>MAX_CLIP_BYTES)throw Error('Choose a clip between 1 byte and 25 MiB.');
 return mime===file.type?file:new File([file],file.name,{type:mime,lastModified:file.lastModified})
}
