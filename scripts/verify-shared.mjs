import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3109';
const controllers = [];
async function client() {
  const controller = new AbortController(); controllers.push(controller);
  const response = await fetch(origin + '/api/events', { signal: controller.signal });
  assert.equal(response.status, 200);
  const events = [];
  (async () => {
    let buffer = '';
    try {
      for await (const chunk of response.body) {
        buffer += new TextDecoder().decode(chunk);
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (block.startsWith('data: ')) events.push(JSON.parse(block.slice(6)));
        }
      }
    } catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  return events;
}
async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw Error('Timed out waiting for shared update');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
async function action(kind, payload, actionId = crypto.randomUUID()) {
  const r = await fetch(origin + '/api/shared', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, payload, actionId }) });
  const d = await r.json(); assert.equal(r.status, 200, JSON.stringify(d)); return d;
}
try {
  const [a, b] = await Promise.all([client(), client()]);
  await waitFor(() => a.some(e=>e.type==='snapshot') && b.some(e=>e.type==='snapshot'));
  const note = 'Shared verification ' + Date.now();
  const id = crypto.randomUUID();
  const first = await action('note', { text: note, author: 'Verification', accountId: 'ACC-8492' }, id);
  const duplicate = await action('note', { text: note, author: 'Verification', accountId: 'ACC-8492' }, id);
  assert.equal(duplicate.revision, first.revision);
  await waitFor(() => [a,b].every(events=>events.some(e=>e.state?.caseNotes.some(n=>n.text===note))));
  console.log('PASS two clients receive the same note; retry does not duplicate it');
  const prefix = crypto.randomUUID();
  await Promise.all(Array.from({length:5}, (_,i)=>action('note',{text:prefix+i,author:'Concurrent verification'})));
  const concurrent = await (await fetch(origin+'/api/shared')).json();
  assert.equal(concurrent.state.caseNotes.filter(n=>n.text.startsWith(prefix)).length,5);
  console.log('PASS five concurrent notes retained');
  await action('decision',{accountId:'ACC-7741',approved:true,author:'Verification'});
  const frozen = await action('freeze',{accountId:'ACC-7741',author:'Verification'});
  assert.equal(frozen.state.accounts.find(x=>x.id==='ACC-7741').status,'frozen');
  const bad = await fetch(origin+'/api/shared',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({actionId:crypto.randomUUID(),kind:'transfer',payload:{transfer:{from:'ACC-7741',to:'ACC-8492',amount:10}}})});
  assert.equal(bad.status,503);
  await action('decision',{accountId:'ACC-7741',approved:false,author:'Verification'});
  console.log('PASS decisions and simulated hold persist; held account cannot send new demo transfers');
  const foreign = await fetch(origin+'/api/shared',{method:'POST',headers:{Origin:'http://wrong.example'}});assert.equal(foreign.status,403);
  console.log('PASS cross-origin write rejected');
} finally { controllers.forEach(c=>c.abort()); }
