// Only fixed phase labels, numeric counts and known job states reach the log.
// Never include request URLs, headers, source records or response bodies.
export function pilotPhase(phase,counts={}){
 const numbers=Object.fromEntries(Object.entries(counts).filter(([,value])=>Number.isFinite(value)));
 console.log('PILOT '+JSON.stringify({phase,...numbers}));
}

export async function trackImport({page,origin,phase,width,channels},action){
 const started=Date.now(),pending=new Set(),states=new Set(['planned','applying','completed','undoing','undone','rolling_back','rolled_back','failed']);
 let responses=0,unreadableResponses=0,latest={},lastState='waiting';
 const report=suffix=>{
  pilotPhase(`${phase}-${suffix}`,{width,channels,elapsedSeconds:Math.round((Date.now()-started)/1000),responses,unreadableResponses,...latest});
 };
 const onFinished=request=>{
  const url=new URL(request.url());
  if(url.origin!==origin||!/^\/api\/slack-imports\/[^/]+\/(apply|resume|undo)$/.test(url.pathname)||request.method()!=='POST')return;
  const task=(async()=>{
   responses++;
   try{
    // Observe only finished browser requests: diagnostics must never wait on
    // an unfinished response body after the real UI wait has already failed.
    const response=await request.response();latest={...latest,httpStatus:response.status()};
    const {job}=await response.json();
    if(job&&Number.isSafeInteger(job.checkpoint)&&Number.isSafeInteger(job.total)){
     latest={httpStatus:response.status(),checkpoint:job.checkpoint,total:job.total};
     if(states.has(job.state)&&job.state!==lastState){lastState=job.state;report(`response-${lastState}`);}
    }
   }catch{unreadableResponses++;}
  })();
  pending.add(task);void task.finally(()=>pending.delete(task));
 };
 page.on('requestfinished',onFinished);
 report('start');
 // Heartbeats show an unchanging checkpoint as well as continuing progress.
 const timer=setInterval(()=>report(`progress-${lastState}`),60_000);
 try{const result=await action();await Promise.all(pending);report('complete');return result;}
 catch(error){report('failed');throw error;}
 finally{clearInterval(timer);page.off('requestfinished',onFinished);await Promise.all(pending);}
}
