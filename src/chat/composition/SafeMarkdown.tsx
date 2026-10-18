import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './composition.css'

type MarkdownNode={type:string;value?:string;alt?:string;children?:MarkdownNode[];position?:{start:{offset?:number};end:{offset?:number}}}
// HTML and images remain visible text. No raw HTML plugin, image element,
// remote image, embed, URL lookup or metadata fetch belongs to message rendering.
function safeNodes(){return (tree:MarkdownNode,file:{toString:()=>string})=>{
 const source=file.toString()
 const visit=(node:MarkdownNode)=>{
  if(node.type==='html'){node.type='text';return}
  if(node.type==='image'){node.type='text';node.value=node.alt||'Image';node.children=undefined}
  // Markdown's backslash escape must not remove the arm from /shrug's text.
  if(node.type==='text'&&source.slice(node.position?.start.offset,node.position?.end.offset).includes('¯\\_(ツ)_/¯'))node.value=node.value?.replaceAll('¯_(ツ)_/¯','¯\\_(ツ)_/¯')
  node.children?.forEach(visit)
 }
 visit(tree)
}}
function safeHref(href:string){
 if(href.startsWith('/')&&!href.startsWith('//')&&!href.includes('\\'))return href
 try{const url=new URL(href);return ['http:','https:','mailto:'].includes(url.protocol)?href:''}catch{return ''}
}
export function SafeMarkdown({text,literal=false}:{text:string;literal?:boolean}){
 if(literal)return <div className="formatted-text literal-text">{text}</div>
 return <ReactMarkdown className="formatted-text" remarkPlugins={[remarkGfm,safeNodes]} transformLinkUri={safeHref} components={{a:({href,children})=>href?<a href={href} rel="noopener noreferrer" target={href.startsWith('/')?undefined:'_blank'}>{children}</a>:<span>{children}</span>,img:({alt})=><span>{alt||'Image'}</span>}}>{text}</ReactMarkdown>
}
