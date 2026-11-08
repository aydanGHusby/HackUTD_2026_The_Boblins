import assert from 'node:assert/strict';
import { analyzeReview } from '../src/review-ai.mjs';
import { applyReviewAction } from '../src/spacetime-bridge.mjs';
const origin=process.env.TEST_ORIGIN || 'http://localhost:3113';
if(!process.env.SPACETIMEDB_REVIEW_DATABASE?.endsWith('-tests'))throw Error('Use a dedicated database ending in -tests');
const aborts=[];
async function openView(user){
  const abort=new AbortController();aborts.push(abort);
  const r=await fetch(origin+'/api/workspace/events?'+new URLSearchParams({user,caseId:'CASE-01'}),{signal:abort.signal});assert.equal(r.status,200);
  const events=[];
  (async()=>{let buffer='';try{for await(const chunk of r.body){buffer+=new TextDecoder().decode(chunk);let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);if(part.startsWith('data: '))events.push(JSON.parse(part.slice(6)));}}}catch(e){if(!abort.signal.aborted)throw e;}})();return events;
}
async function wait(test){const deadline=Date.now()+10000;while(!test()){if(Date.now()>deadline)throw Error('Event timeout');await new Promise(r=>setTimeout(r,25));}}
async function post(kind,payload,actionId=crypto.randomUUID()){
  const r=await fetch(origin+'/api/workspace',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({kind,payload,actionId})});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return {body,id:actionId};
}
try{
  const initial=await (await fetch(origin+'/api/workspace')).json();assert.equal(initial.state.companies.length,5);
  const [a,b]=await Promise.all([openView('First reviewer'),openView('Second reviewer')]);
  await wait(()=>a.some(e=>e.viewers?.length===2)&&b.some(e=>e.type==='snapshot'));
  const input={borrowerId:'c5',amount:3000000,purpose:'Integration verification',collateralIds:['col1'],guarantorIds:['p1']};
  const {body:created,id}=await post('loan',{input,actor:'Verification'});
  const caseId='CASE-'+id;
  assert(created.state.cases.some(c=>c.id===caseId&&c.status==='queued'));
  const count=created.state.loans.length;const retry=await post('loan',{input,actor:'Verification'},id);assert.equal(retry.body.state.loans.length,count);
  await wait(()=>[a,b].every(events=>events.some(e=>e.state?.cases.some(c=>c.id===caseId))));
  console.log('PASS intake and risk rules, duplicate-action protection, and two-client case sync');
  await Promise.all([post('note',{caseId,actor:'One',text:'First concurrent note'}),post('note',{caseId,actor:'Two',text:'Second concurrent note'})]);
  const noteState=await(await fetch(origin+'/api/workspace')).json();assert.equal(noteState.state.notes.filter(n=>n.caseId===caseId).length,2);
  const invalid=await fetch(origin+'/api/workspace',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({kind:'verdict',actionId:crypto.randomUUID(),payload:{caseId,actor:'Test',decision:'fraud',reasoning:'Too early'}})});assert.equal(invalid.status,503);
  console.log('PASS concurrent notes retained; premature decision rejected');
  const missing=await fetch(origin+'/api/workspace/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({caseId})});assert.equal(missing.status,503);assert((await missing.json()).error.includes('Configure NVIDIA'));
  const aiResponse={arguments:[{side:'prosecution',claims:[{text:'The supplied collateral is linked to another loan.',citations:['col1']}]},{side:'defense',claims:[{text:'A nonexistent filing cannot establish a legitimate lien.',citations:['missing-filing']}]}],crux:{agreed:['A collateral link exists.'],disputed:[{point:'Priority of liens is unknown.',decidingFact:'An independently checked lien record.'}]}};
  const provider=async()=>Response.json({choices:[{message:{content:JSON.stringify(aiResponse)}}]});
  const analysis=await analyzeReview(noteState,caseId,undefined,{NVIDIA_API_KEY:'test',NVIDIA_MODEL:'test'},provider);
  assert.equal(analysis.arguments[0].claims[0].verified,true);assert.equal(analysis.arguments[1].claims[0].verified,false);
  await applyReviewAction({actionId:crypto.randomUUID(),kind:'analysis',payload:{...analysis,actor:'Provider-stub verification'}});
  await assert.rejects(()=>analyzeReview(noteState,caseId,undefined,{NVIDIA_API_KEY:'test',NVIDIA_MODEL:'test'},async()=>Response.json({choices:[{message:{content:'bad json'}}]})),/invalid JSON/);
  const {id:questionId}=await post('question',{caseId,actor:'Test',to:'defense',text:'Which lien documents are missing?'});
  const qstate=await(await fetch(origin+'/api/workspace')).json();
  const answer=await analyzeReview(qstate,caseId,questionId,{NVIDIA_API_KEY:'test',NVIDIA_MODEL:'test'},async()=>Response.json({choices:[{message:{content:JSON.stringify({arguments:[aiResponse.arguments[1]]})}}]}));
  await applyReviewAction({actionId:crypto.randomUUID(),kind:'analysis',payload:{...answer,actor:'Provider-stub verification'}});
  await post('verdict',{caseId,actor:'Reviewer',decision:'escalate',reasoning:'Lien priority needs a senior reviewer.'});
  const final=await post('signoff',{caseId,actor:'Senior demo reviewer',decision:'not_fraud',reasoning:'Recorded demo sign-off for integration test.'});
  assert(final.body.state.questions.find(q=>q.id===questionId).answerId);
  assert.equal(final.body.state.loans.find(l=>l.id==='L-'+id).status,'intake');
  assert(final.body.state.audit.filter(a=>a.caseId===caseId).length>=7);
  console.log('PASS structured AI validation with stub provider, unknown-source handling, saved agent answer, escalation, and senior sign-off');
  console.log('PASS missing NVIDIA configuration fails visibly; no canned AI fallback');
}finally{aborts.forEach(c=>c.abort());}

// Separate evaluation path: no AI run is required to decide a score-only case.
const baseline = await post('loan',{input:{borrowerId:'c5',amount:4000000,purpose:'Score-only evaluation',collateralIds:['col1'],guarantorIds:[]},actor:'Evaluator'});
const baselineCase='CASE-'+baseline.id;
const request=await post('information_request',{caseId:baselineCase,actor:'Evaluator',text:'Obtain independent lien records.'});
assert(request.body.state.notes.some(n=>n.caseId===baselineCase&&n.text==='Information requested\nObtain independent lien records.'));
const reviewed=await post('verdict',{caseId:baselineCase,actor:'Evaluator',decision:'not_fraud',reasoning:'Shared asset was disclosed for this evaluation.',reviewMode:'score'});
assert.equal(reviewed.body.state.cases.find(c=>c.id===baselineCase).status,'decided');
assert(reviewed.body.state.audit.some(a=>a.caseId===baselineCase&&a.action==='Score-only review decision: not_fraud'));
console.log('PASS saved information requests and queued-case score-only decisions without AI');
