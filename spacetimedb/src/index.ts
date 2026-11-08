import { schema, table, t } from 'spacetimedb/server';
import seed from './seed.json';

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
