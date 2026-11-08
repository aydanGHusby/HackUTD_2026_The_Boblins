# Paper Trail

**Commercial-loan fraud review where the evidence is filed by code, the AI argues both sides, and a human decides.**
*Built for HackUTD 2026 · Goldman Sachs challenge*

> "Build a comprehensive platform that automates and secures the entire lifecycle of commercial loan processing, leveraging AI/ML capabilities to detect hidden, cross-deal fraud patterns and achieve operational excellence."

## How a loan moves through Paper Trail

1. **Intake.** An analyst submits a loan. Risk rules check it right away: collateral already pledged elsewhere, a new company asking for a large loan, an amount far above revenue, and links to other deals through shared people or addresses. Clean loans are approved automatically; flagged loans open a case.
2. **The clerk (code, not AI).** The clerk files numbered exhibits: credit metrics (LTV, loan-to-revenue, company age, guarantor exposure across all loans) and a search across every deal for shared directors and owners, the same address written differently, and collateral pledged twice. Because the clerk is code, the evidence can't be made up.
3. **The debate (NVIDIA Nemotron).** A Risk agent argues the case is fraud and a Legitimacy agent argues it's a real business. Both sides argue in parallel, every claim has to cite exhibit or record IDs, and a trial takes about 10 seconds.
4. **The fact-checker (code).** Any claim that cites an ID that doesn't exist is hidden.
5. **The credit memo (AI suggestion).** A short bank-style memo: approve, approve with conditions, decline, or escalate; conditions before funding; documents to request; and what both sides agree on or still dispute.
6. **The decision (human).** The analyst records fraud, not fraud, or escalate. Loans over $1M need a Senior sign-off from a different person (four eyes). Every action goes into the audit history.
7. **The lifecycle.** Applied → Checked → AI review → Decided → Closed → Funded → Monitored, with Close and Fund steps on the case page.
8. **Operations.** The `/ops` page shows cases waiting, time to decision, the auto-approval rate, and the decision split.

## How it maps to the prompt

| Prompt | Paper Trail |
|---|---|
| Entire lifecycle | Lifecycle bar from application to monitoring; Close and Fund steps |
| Automates | Rules on intake, automatic approval of clean loans, a worker that debates new cases on its own, a credit memo after every trial |
| Secures | Code-filed evidence, the citation fact-checker, Senior sign-off over $1M, four eyes, the audit log |
| AI/ML | Two Nemotron agents arguing with cited evidence; credit metrics computed by code |
| Hidden, cross-deal fraud patterns | Cross-deal search over all loans; the CASE-06 fraud ring (one director, four companies, one address written two ways, one warehouse backing two loans) |
| Operational excellence | Operations page |

## Demo data

All companies, people and loans are **synthetic**, modeled on common commercial-lending fraud patterns. Real loan files aren't public, and the data names no real businesses.

## Running it

Requirements: Node.js 22.18+ and an NVIDIA API key for `nvidia/nemotron-3.5-super-vl-120b-a12b`.

```bash
cp .env.example .env              # add NVIDIA_API_KEY; set SPACETIMEDB_URL / SPACETIMEDB_DATABASE for the shared database
cd frontend && npm install && cd ..
npm run dev                       # app at http://localhost:3200
npm run worker:spacetime          # optional: debates new cases automatically
```

On a Mac, `Start-Paper-Trail.command` starts a local SpacetimeDB and the app together.

Tests: `npm run worker:test` (worker) and `cd frontend && npx vitest run` (app).

## Project layout

```
frontend/     The app (React + TanStack Start): pages, agents, shared metrics/clerk/memo code
worker/       Background courtroom worker: clerk, Nemotron agents, citation checks
shared/       Types and graph helpers used by the worker
spacetimedb/  Database module (one shared loan_state row updated by ops)
scripts/      Local database and launcher helpers
docs/         Team notes
```
