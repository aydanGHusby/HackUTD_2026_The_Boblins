import { schema, table, t } from 'spacetimedb/server';
import seed from './seed.json';
import reviewSeed from './review-seed.json';

// A single demo case is updated atomically, including its audit trail.
const spacetimedb = schema({
  dashboard: table({ public: true }, { id: t.string().primaryKey(), data: t.string(), revision: t.u32() }),
  appliedAction: table({ public: false }, { id: t.string().primaryKey() }),
});
export default spacetimedb;
export const init = spacetimedb.init(ctx => {
  ctx.db.dashboard.insert({ id: 'main', data: JSON.stringify(seed), revision: 0 });
});

export const applyAction = spacetimedb.reducer({ actionId: t.string(), kind: t.string(), payload: t.string() }, (ctx, args) => {
  if (ctx.db.appliedAction.id.find(args.actionId)) return;
  if (args.payload.length > 100000) throw new Error('Action too large');
  const row = ctx.db.dashboard.id.find('main');
  if (!row) throw new Error('Demo case not initialized');
  const s = JSON.parse(row.data);
  const p = JSON.parse(args.payload);
  const account = s.accounts.find((a: any) => a.id === p.accountId);
  const time = ctx.timestamp.toDate().toISOString();
  const author = String(p.author || 'Analyst').slice(0, 60);
  let description = '';
  if (args.kind === 'note') {
    const text = String(p.text || '').trim();
    if (!text || text.length > 2000) throw new Error('Note must contain 1–2,000 characters');
    s.caseNotes.unshift({ id: args.actionId, accountId: p.accountId, author, text, time });
    description = 'Added a case note';
  } else if (args.kind === 'decision' || args.kind === 'freeze') {
    if (!account) throw new Error('Account not found');
    if (args.kind === 'freeze') { account.status = 'frozen'; description = 'Simulated hold on ' + account.id; }
    else {
      if (typeof p.approved !== 'boolean') throw new Error('Decision must be boolean');
      s.decisions[account.id] = { decision: p.approved ? 'yes' : 'no', timestamp: time, analyst: author };
      account.status = p.approved ? 'flagged_mule' : 'normal';
      account.riskScore = p.approved ? 98 : 15;
      description = (p.approved ? 'Flagged ' : 'Dismissed alert for ') + account.id;
    }
  } else if (args.kind === 'transfer') {
    const tx = p.transfer;
    if (!tx || !Number.isFinite(tx.amount) || tx.amount <= 0 || tx.from === tx.to) throw new Error('Invalid transfer');
    const from = s.accounts.find((a: any) => a.id === tx.from);
    if (!from || !s.accounts.some((a: any) => a.id === tx.to)) throw new Error('Unknown account');
    if (from.status === 'frozen') throw new Error('Demo account is on hold');
    s.transfers.push({ ...tx, id: args.actionId, time });
    description = 'Recorded simulated transfer ' + tx.from + ' → ' + tx.to;
  } else if (args.kind === 'investigation') {
    if (!account || typeof p.report !== 'string') throw new Error('Invalid investigation');
    s.investigations[account.id] = p.report;
    description = 'Saved investigation for ' + account.id;
  } else if (args.kind === 'prediction') {
    if (!Array.isArray(p.predictions)) throw new Error('Invalid predictions');
    for (const prediction of p.predictions) {
      if (!s.accounts.some((a: any) => a.id === prediction.id) || !Number.isFinite(prediction.riskScore) || prediction.riskScore < 0 || prediction.riskScore > 100) throw new Error('Invalid predicted account or score');
    }
    s.predictions = p.predictions;
    s.predictionActive = true;
    for (const a of s.accounts) {
      if (a.status === 'predicted_risk') a.status = 'normal';
    }
    for (const prediction of p.predictions) {
      const a = s.accounts.find((a: any) => a.id === prediction.id);
      if (a.status !== 'frozen' && a.status !== 'flagged_mule') { a.status = 'predicted_risk'; a.riskScore = Math.max(a.riskScore, prediction.riskScore); }
    }
    description = 'Saved ' + p.predictions.length + ' risk suggestions';
  } else throw new Error('Unsupported action');
  s.activityFeed.unshift({ id: args.actionId, user: author, action: description, time });
  s.activityFeed = s.activityFeed.slice(0, 100);
  ctx.db.dashboard.id.update({ ...row, data: JSON.stringify(s), revision: row.revision + 1 });
  ctx.db.appliedAction.insert({ id: args.actionId });
});

// Commercial-loan workspace for Sai's frontend. The original account demo is retained.
export const initializeReview = spacetimedb.reducer(ctx => {
  if (!ctx.db.dashboard.id.find('review')) {
    ctx.db.dashboard.insert({ id: 'review', data: JSON.stringify(reviewSeed), revision: 0 });
  }
});

export const reviewAction = spacetimedb.reducer({ actionId: t.string(), kind: t.string(), payload: t.string() }, (ctx, args) => {
  if (ctx.db.appliedAction.id.find(args.actionId)) return;
  if (args.payload.length > 200000) throw new Error('Action too large');
  const row = ctx.db.dashboard.id.find('review');
  if (!row) throw new Error('Loan workspace not initialized');
  const s = JSON.parse(row.data);
  const p = JSON.parse(args.payload);
  const at = ctx.timestamp.toDate().toISOString();
  const actor = String(p.actor || 'Analyst').slice(0, 80);
  const c = s.cases.find((item: any) => item.id === p.caseId);
  const requiredText = (value: unknown, min = 1) => {
    if (typeof value !== 'string' || value.trim().length < min || value.length > 5000) throw new Error('Enter valid text');
    return value.trim();
  };
  const record = (action: string, caseId = p.caseId) => s.audit.push({ id: args.actionId, caseId, actor, action, at });
  if (args.kind === 'loan') {
    const input = p.input;
    const borrower = s.companies.find((item: any) => item.id === input?.borrowerId);
    if (!borrower || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e12) throw new Error('Select a borrower and a valid loan amount');
    const purpose = requiredText(input.purpose);
    if (!Array.isArray(input.collateralIds) || !Array.isArray(input.guarantorIds)) throw new Error('Invalid loan links');
    const cols = [...new Set<string>(input.collateralIds)];
    const guars = [...new Set<string>(input.guarantorIds)];
    if (cols.some(id => !s.collateral.some((item: any) => item.id === id)) || guars.some(id => !s.people.some((item: any) => item.id === id))) throw new Error('Unknown collateral or guarantor');
    const loanId = 'L-' + args.actionId;
    const caseId = 'CASE-' + args.actionId;
    const triggers: string[] = [];
    if (cols.some(id => s.edges.some((e: any) => e.from === id && e.kind === 'pledged_to' && !['declined'].includes(s.loans.find((l: any) => l.id === e.to)?.status)))) triggers.push('duplicate_collateral');
    if (Date.parse(at) - Date.parse(borrower.registeredOn) < 365 * 86400000 && input.amount > 1000000) triggers.push('new_company_large_loan');
    if (input.amount > borrower.annualRevenue * 3) triggers.push('amount_vs_revenue');
    s.loans.push({ id: loanId, borrowerId: input.borrowerId, amount: input.amount, purpose, createdOn: at.slice(0, 10), status: triggers.length ? 'under_review' : 'intake' });
    const edges = [{ id: 'borrower-' + args.actionId, from: input.borrowerId, to: loanId, kind: 'borrower_of' }, ...cols.map(id => ({ id: id + '-' + args.actionId, from: id, to: loanId, kind: 'pledged_to' })), ...guars.map(id => ({ id: id + '-' + args.actionId, from: id, to: loanId, kind: 'guarantees' }))];
    s.edges.push(...edges);
    if (triggers.length) {
      s.cases.push({ id: caseId, loanId, riskScore: Math.min(100, 20 + triggers.length * 30), triggers, status: 'queued' });
      s.flaggedEdges[caseId] = edges.filter(e => e.kind === 'pledged_to').map(e=>e.id);
      s.evidence.push({ id: 'evidence-' + args.actionId, caseId, fact: 'Requested ' + input.amount + ' USD for ' + purpose + '. Rule indicators: ' + triggers.join(', '), citations: [input.borrowerId, loanId, ...cols] });
    }
    record('Submitted ' + loanId + (triggers.length ? '; opened review case' : '; saved for intake'), triggers.length ? caseId : loanId);
  } else {
    if (!c) throw new Error('Case not found');
    const loan = s.loans.find((l: any) => l.id === c.loanId);
    if (args.kind === 'note' || args.kind === 'information_request') {
      if (args.kind === 'information_request' && c.status === 'decided') throw new Error('Case already decided');
      const text = requiredText(p.text);
      s.notes.push({ id: args.actionId, caseId: c.id, author: actor, text: args.kind === 'information_request' ? 'Information requested\n' + text : text, at });
      record(args.kind === 'information_request' ? 'Requested more information' : 'Added a note');
    } else if (args.kind === 'verdict') {
      if (!(c.status === 'awaiting_verdict' || (p.reviewMode === 'score' && c.status === 'queued')) || s.verdicts.some((v: any) => v.caseId === c.id)) throw new Error('This case is not awaiting a decision');
      if (!['fraud', 'not_fraud', 'escalate'].includes(p.decision)) throw new Error('Invalid decision');
      s.verdicts.push({ caseId: c.id, analyst: actor, decision: p.decision, reasoning: requiredText(p.reasoning, 5), decidedAt: at });
      c.status = 'decided';
      loan.status = p.decision === 'fraud' ? 'under_review' : p.decision === 'not_fraud' ? 'intake' : 'escalated';
      record((p.reviewMode === 'score' ? 'Score-only review decision: ' : 'Analyst decision: ') + p.decision);
    } else if (args.kind === 'signoff') {
      if (!s.verdicts.some((v: any)=>v.caseId===c.id && v.decision==='escalate') || s.signOffs.some((v: any)=>v.caseId===c.id)) throw new Error('Case is not awaiting senior review');
      if (!['fraud','not_fraud'].includes(p.decision)) throw new Error('Invalid sign-off');
      s.signOffs.push({ caseId:c.id, reviewer:actor, decision:p.decision, reasoning:requiredText(p.reasoning,5), at });
      loan.status = p.decision === 'fraud' ? 'under_review' : 'intake';
      record('Demo senior sign-off: ' + p.decision);
    } else if (args.kind === 'question') {
      if(c.status==='decided') throw new Error('Case already decided');
      if(!['prosecution','defense'].includes(p.to)) throw new Error('Unknown agent');
      s.questions.push({id:args.actionId,caseId:c.id,askedBy:actor,to:p.to,text:requiredText(p.text)});
      record('Asked '+p.to+' a question');
    } else if (args.kind === 'analysis') {
      if(c.status==='decided') throw new Error('Case already decided');
      if(!Array.isArray(p.arguments) || !p.arguments.length) throw new Error('No AI arguments returned');
      if (p.questionId) {
        const question=s.questions.find((q:any)=>q.id===p.questionId && q.caseId===c.id);
        if(!question || question.answerId) throw new Error('Question missing or already answered');
        question.answerId=p.arguments[0].id;
        s.arguments.push(...p.arguments);
      } else {
        s.arguments=s.arguments.filter((a:any)=>a.caseId!==c.id).concat(p.arguments);
        s.cruxes=s.cruxes.filter((item:any)=>item.caseId!==c.id);
        if(p.crux) s.cruxes.push(p.crux);
        c.status='awaiting_verdict';
      }
      record(p.questionId?'Nemotron answered a question':'Nemotron completed both case perspectives');
    } else throw new Error('Unknown loan-workspace action');
  }
  ctx.db.dashboard.id.update({...row,data:JSON.stringify(s),revision:row.revision+1});
  ctx.db.appliedAction.insert({id:args.actionId});
});
