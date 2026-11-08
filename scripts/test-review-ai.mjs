import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeReview } from '../src/review-ai.mjs';
const snapshot={state:JSON.parse(fs.readFileSync(new URL('../spacetimedb/src/review-seed.json',import.meta.url),'utf8'))};
const result={arguments:['prosecution','defense'].map(side=>({side,round:'opening',claims:[{text:'Review supplied collateral links.',citations:['col1']}]})),crux:{agreed:['A collateral record is present.'],disputed:[]}};
const env={NVIDIA_API_KEY:'test',NVIDIA_MODEL:'test'};
for(const content of [JSON.stringify(result),'```json\n'+JSON.stringify(result)+'\n```','Here is the review:\n'+JSON.stringify(result),'<think>Private reasoning omitted</think>\n'+JSON.stringify(result)]){
 const output=await analyzeReview(snapshot,'CASE-01',undefined,env,async(url,options)=>{
  const request=JSON.parse(options.body);
  assert.equal(request.stream,false);assert.equal(request.reasoning_effort,'none');assert.equal(request.response_format.type,'json_schema');
  assert(request.response_format.json_schema.schema.required.includes('crux'));
  return Response.json({choices:[{finish_reason:'stop',message:{content}}]});
 });
 assert.equal(output.arguments.length,2);
}
await assert.rejects(()=>analyzeReview(snapshot,'CASE-01',undefined,env,async()=>Response.json({choices:[{message:{content:'{"arguments": ['}}]})),/invalid JSON|no JSON/);
await assert.rejects(()=>analyzeReview(snapshot,'CASE-01',undefined,env,async()=>Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(result)}}]})),/stopped before completing/);
snapshot.state.questions.push({id:'test-q',caseId:'CASE-01',to:'defense',text:'What is missing?'});
const answer=await analyzeReview(snapshot,'CASE-01','test-q',env,async(url,options)=>{
 const schema=JSON.parse(options.body).response_format.json_schema.schema;
 assert.deepEqual(schema.required,['arguments']);
 assert.deepEqual(schema.properties.arguments.items.properties.side.enum,['defense']);
 return Response.json({choices:[{message:{content:JSON.stringify({arguments:[result.arguments[1]]})}}]});
});assert.equal(answer.arguments[0].round,'answer');
console.log('PASS structured request, plain/fenced/wrapped JSON, reasoning wrappers, truncated/malformed rejection, and follow-up schema');
