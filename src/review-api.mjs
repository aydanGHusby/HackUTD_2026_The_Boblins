import { initializeReviewState, readReviewState, applyReviewAction } from './spacetime-bridge.mjs';
import { analyzeReview } from './review-ai.mjs';

const clients = new Map();
let initialized = false;
let initialization;
let revision = -1;
let polling = false;
const runningAI = new Set();
const send = (response, value) => response.write(`data: ${JSON.stringify(value)}\n\n`);
const broadcast = value => { for(const response of clients.keys()) send(response,value); };
function presence(){broadcast({type:'presence',viewers:[...clients.values()]});}
async function ready(){
  if(initialized)return;
  if(!initialization) initialization=initializeReviewState().then(()=>{initialized=true;}).finally(()=>{initialization=undefined;});
  await initialization;
}
function json(response,status,value){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));}
async function body(req){
  let text='';for await(const chunk of req){text+=chunk;if(text.length>200000)throw Error('Request too large');}
  return JSON.parse(text);
}
export async function handleReviewAPI(req,res,url){
  if(!url.pathname.startsWith('/api/workspace'))return false;
  if(req.method!=='GET' && req.headers.origin!==url.origin){json(res,403,{error:'Origin rejected'});return true;}
  try{
    await ready();
    if(url.pathname==='/api/workspace/events' && req.method==='GET'){
      const snapshot=await readReviewState();
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
      clients.set(res,{user:(url.searchParams.get('user')||'Analyst').slice(0,80),caseId:(url.searchParams.get('caseId')||'').slice(0,100)});
      send(res,{type:'snapshot',...snapshot});presence();
      req.on('close',()=>{clients.delete(res);presence();});return true;
    }
    if(url.pathname==='/api/workspace' && req.method==='GET'){json(res,200,await readReviewState());return true;}
    if(url.pathname==='/api/workspace' && req.method==='POST'){
      const action=await body(req);
      if(!['note','information_request','verdict','signoff','loan','question'].includes(action.kind))throw Error('Unsupported action');
      const result=await applyReviewAction(action);broadcast({type:'snapshot',...result});json(res,200,result);return true;
    }
    if(url.pathname==='/api/workspace/analyze' && req.method==='POST'){
      const {caseId,questionId}=await body(req);
      const key=caseId+':'+(questionId||'review');
      if(runningAI.has(key)){json(res,409,{error:'Analysis already running for this case'});return true;}
      runningAI.add(key);
      try{
        const result=await analyzeReview(await readReviewState(),caseId,questionId,process.env);
        const saved=await applyReviewAction({actionId:crypto.randomUUID(),kind:'analysis',payload:{...result,actor:'NVIDIA Nemotron'}});
        broadcast({type:'snapshot',...saved});json(res,200,saved);
      }finally{runningAI.delete(key);}
      return true;
    }
    json(res,404,{error:'Workspace endpoint not found'});
  }catch(error){json(res,503,{error:error.message});}
  return true;
}
const timer=setInterval(async()=>{
  if(!clients.size||polling)return;
  polling=true;
  try{
    const result=await readReviewState();
    if(result.revision!==revision){revision=result.revision;broadcast({type:'snapshot',...result});}
    else broadcast({type:'heartbeat'});
  }catch{broadcast({type:'unavailable'});initialized=false;}
  finally{polling=false;}
},1000);
timer.unref();
