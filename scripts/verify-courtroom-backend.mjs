import assert from 'node:assert/strict';
import * as mock from '../frontend/src/mock/mockData.ts';
const database=process.env.SPACETIMEDB_DATABASE||'paper-view-courtroom-tests';
if(!database.endsWith('-tests'))throw Error('Use an isolated database ending in -tests');
const root=`http://127.0.0.1:3108/v1/database/${database}`;
async function request(path,body){const r=await fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(r.ok,true,`Database request failed: ${r.status}`);return r;}
const seed={cases:mock.cases,loans:mock.loans,edges:mock.edges,arguments:mock.argumentsList,questions:mock.questions,verdicts:mock.verdicts,notes:mock.notes,audit:mock.audit,signOffs:[],presence:[],running:[]};
await request('/call/reset_loans',JSON.stringify([JSON.stringify(seed)]));
const read=async()=>{const rows=await(await request('/sql',"SELECT data, revision FROM loan_state WHERE id = 'main'")).json();const row=rows[0].rows[0];return {state:JSON.parse(row[0]),revision:row[1]};};
const op=(id,text)=>({op:'append',table:'notes',item:{id,caseId:'CASE-01',author:'Integration verification',text,at:new Date().toISOString()}});
const first=crypto.randomUUID(),second=crypto.randomUUID();
const write=(id,ops)=>request('/call/apply_loan_ops',JSON.stringify([id,JSON.stringify(ops)]));
await Promise.all([write(first,[op(first,'First concurrent note')]),write(second,[op(second,'Second concurrent note')])]);
await write(first,[op(first,'Duplicate must not be saved')]);
const [a,b]=await Promise.all([read(),read()]);
for(const result of [a,b]){assert.equal(result.state.notes.filter(n=>n.id===first).length,1);assert.equal(result.state.notes.filter(n=>n.id===second).length,1);}
assert.equal(a.revision,b.revision);
await write(crypto.randomUUID(),[{op:'update',table:'loans',key:'id',value:'L-1001',patch:{stage:'monitored'}},{op:'append',table:'audit',item:{id:crypto.randomUUID(),caseId:'CASE-01',actor:'Integration verification',action:'Verified stage persistence',at:new Date().toISOString()}}]);
assert.equal((await read()).state.loans.find(l=>l.id==='L-1001').stage,'monitored');
console.log('PASS canonical loan_state: two-client reads, concurrent notes, duplicate-action protection, lifecycle stage and audit persistence.');
