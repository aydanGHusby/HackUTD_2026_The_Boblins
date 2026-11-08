I am Person [A or B] on a 4-person HackUTD 2026 team. Read all of this before doing anything, then help me with MY tasks only (Person A or Person B below). Ask before every git push. Never add AI/Claude co-author or attribution lines to commits.

# Project: Paper Trail
A commercial-loan fraud review app for the Goldman Sachs challenge at HackUTD 2026. Devpost deadline: Sun Nov 8, 12:00 PM CST. Internal cut-off for code: 10:30 AM CST.

Goldman Sachs prompt: "Build a comprehensive platform that automates and secures the entire lifecycle of commercial loan processing, leveraging AI/ML capabilities to detect hidden, cross-deal fraud patterns and achieve operational excellence." (They called it "DealPilot"; our name is Paper Trail.)

## How the app works today
1. An analyst submits a loan on the "New loan" page. Risk rules check it (duplicate collateral, new company with a large loan, amount vs revenue). Clean loans auto-approve; flagged loans open a case with status "queued".
2. Two NVIDIA Nemotron agents debate the case: the Risk agent (prosecution) argues fraud, the Legitimacy agent (defense) argues it's legitimate. Every claim must cite real graph IDs (company c1, person p1, collateral col1, loan L-1001, edge e4, evidence ev-…). A fact-checker hides claims citing IDs that don't exist.
3. A "crux" summary shows "Where they agree" and "Still disputed → Would be settled by".
4. A human analyst decides: fraud / not fraud / escalate. Escalations need a Senior sign-off. Everything goes in an audit log.
5. All shared state syncs through SpacetimeDB (cloud database `fraudgraph-boblins` on maincloud) as one JSON row (`loan_state`) updated by ops (append/update/remove on lists).

## Repo and setup
- Repo: github.com/aydanGHusby/HackUTD_2026_The_Boblins, local path ~/Projects/FraudGraph
- Start from branch `backend` (latest, commit 1e1523e). Make your own branch from it.
- Root `.env` (git-ignored, get it privately from the team): NVIDIA_API_KEY, NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b, NEMOTRON_THINKING=off, SPACETIMEDB_URL=https://maincloud.spacetimedb.com, SPACETIMEDB_DATABASE=fraudgraph-boblins
- Run the app: `cd frontend && npx vite dev --port 3200` → http://localhost:3200 (port 3000 is taken)
- Run the AI worker on queued cases: `npm run worker:spacetime -- --case CASE-05 --once` (root folder). Worker tests: `npm run worker:test` (31 pass).
- Typecheck frontend: `cd frontend && npx tsc --noEmit -p .`
- 3 tests in frontend/src/test/theme.test.ts already fail (localStorage under Node 26); ignore them.
- Don't commit frontend/package-lock.json (the frontend uses Bun).

## Two ways a trial runs
- "Run trial" button in the app: frontend/src/agents/trial.ts (server function `argueFn`) via `runTrial` in frontend/src/data/hooks.ts. Openings + rebuttals, ~7-11 s. Does NOT write evidence or crux.
- Worker (Likith's): worker/ folder. Clerk writes evidence, then openings + rebuttals (both sides in parallel), then crux. ~17 s, 6 Nemotron calls. Writes evidence and crux to the database. Only picks up cases with status "queued".
- NVIDIA free tier: ~40 requests/min per key. Keep thinking mode off (on = minutes per trial).

## Key files
- frontend/src/shared/types.ts — types the app uses
- shared/types.ts — types the worker uses. THE TWO COPIES ARE NOT IDENTICAL: if you change a shared type, update both.
- frontend/src/data/hooks.ts — store, `commit(...ops)`, polling, `submitLoan` (risk rules ~line 300), `runTrial`, `submitVerdict`, `signOff`, `useCrux`, `useEvidence`, `useEscalations`
- frontend/src/routes/case.$id.tsx — case page: network map, "Where they agree" crux box (~line 90), agent discussion, decision box
- frontend/src/routes/{cases,intake,escalations,index}.tsx — other pages; frontend/src/components/AppSidebar.tsx — nav + name field + Analyst/Senior role switch
- frontend/src/components/AgentChat.tsx — the debate chat
- frontend/src/mock/mockData.ts — demo companies, people, collateral, loans, edges (all synthetic)
- worker/fixtures/sample-court.json — worker's copy of the same demo data (currently identical companies/people/collateral; keep them in sync)
- worker/trial.ts, worker/agents.ts, worker/prompts.ts, worker/tools.ts — worker trial flow, agents, prompts, tools
- shared/graph.ts — graph helpers: buildIndex, neighbors, subgraph, shortestPath, sharedAttributes
- spacetimedb/src/index.ts — database module. Allowed lists: cases, loans, edges, arguments, questions, verdicts, notes, audit, signOffs, presence, running, evidence, cruxes. If you add a new list, add it there AND republish the module to maincloud (ask Dadrean; it needs his login).

## Demo data (synthetic)
5 companies (c1 Harbor Freight Logistics, c2 Bayline Holdings, c3 Crestview Manufacturing, c4 Northwind Produce, c5 Atlas Ridge Ventures), 3 people (p1 Daniel Okafor, p2 Marisa Kell, p3 Victor Lune), 4 collateral, 5 loans, 20 edges, 5 cases. CASE-01 = same warehouse (col1) pledged to two loans + shared director/address. CASE-05 = new company asking $3M against $400K collateral.

# The plan: match every part of the Goldman Sachs prompt

| Prompt part | Feature | Owner |
|---|---|---|
| AI/ML capabilities | Banking numbers for the agents | A |
| Hidden, cross-deal fraud patterns | Cross-deal investigator + fraud-ring demo case | A |
| Automates | AI credit memo | A |
| Entire lifecycle | Loan progress bar + Close/Fund steps | B |
| Operational excellence | Operations page | B |
| Secures | Approval rules | B |

## Person A — AI and data (worker/, shared/, agent prompts, demo data)

A1. Banking numbers (computed by code, not the AI)
- Add a function (e.g. shared/metrics.ts) that, for a loan, returns: LTV = loan amount / total pledged collateral value; loan-to-revenue = amount / borrower annual revenue; guarantor exposure = each guarantor's total guaranteed amount across ALL loans vs their net worth; collateral pledged to more than one loan (yes/no).
- Put these numbers into the case brief both agents read: worker/prompts.ts `caseBrief` AND frontend/src/agents/trial.ts `prompt`. Tell the agents to cite them and to use banking language (LTV, coverage, lien, guarantor exposure).
- Done when: a trial on CASE-05 mentions LTV ~7.5x with correct numbers.

A2. Fraud-ring demo case
- Add to BOTH mockData.ts and sample-court.json: 3 new companies sharing one director and one address, one warehouse pledged to two of their loans, plus a new loan + case (status "queued").
- Use new IDs that don't collide (e.g. c6–c8, p4, col5, L-1006/L-1007, e30+, CASE-06). Use the existing loan `status` field only; don't add lifecycle fields (Person B owns those).
- Note: the cloud database already has seeded data; new mock entries may need `resetDemo()` (resets the shared DB to mock data, wipes test notes/verdicts). Coordinate with the team before resetting.

A3. Cross-deal investigator
- Using shared/graph.ts, search ALL loans (not just 2 hops) for links to this loan's borrower, directors, guarantors, address and collateral. Output a short list like "Borrower shares director p4 with c7 and c8 (loans L-1006, L-1007)".
- Add the findings to the case brief (and as evidence items in the worker so they show in the Evidence tab).
- Done when: the ring case shows links to all 3 companies.

A4. Credit memo (replaces the "Where they agree" box)
- Extend the crux prompt in worker/prompts.ts (`cruxTask`) and the crux validator in worker/agents.ts to also return: recommendation (approve / approve with conditions / decline / escalate), conditions (list), documents to request (list, e.g. "current appraisal of col4", "UCC lien search on col1").
- Add the new optional fields to the Crux type in BOTH types files.
- Build frontend/src/components/CreditMemo.tsx and swap ONLY the crux box section in case.$id.tsx (~line 90) to render it. Keep agreed/disputed visible. Don't touch the rest of the case page.
- Done when: a worker run on CASE-05 shows a memo with recommendation + documents.

A5. Test: `npm run worker:test`, typecheck, run the worker once on the ring case and on CASE-05.

## Person B — app screens (hooks.ts, case page header + decision box, sidebar, new pages)

B1. Loan progress bar (entire lifecycle)
- Stages: Applied → Checked → AI review → Decided → Closed → Funded → Monitored (plus Declined).
- Add an optional `stage` field to Loan in BOTH types files. Derive the stage when missing (from loan status + case status + verdict) so old data and Person A's new demo data work without edits. Do NOT edit mockData.ts.
- Build frontend/src/components/LifecycleBar.tsx; put it at the top of case.$id.tsx (header area only).
- Add `advanceLoan(loanId, stage, actor)` in hooks.ts: commit an update op on `loans` plus an audit entry.
- After a "not fraud" verdict (or Senior sign-off), show "Mark closed" then "Fund loan" buttons; after funding the stage shows Monitored.
- Done when: one loan goes Applied → Monitored and every step shows in History (audit).

B2. Operations page (operational excellence)
- `useOpsMetrics()` in hooks.ts computed from existing data: cases waiting (queued/awaiting_verdict) and oldest waiting; average time from loan createdOn to verdict decidedAt; % of loans auto-approved (loans with no case); fraud / not fraud / escalated split; trials run (audit entries).
- New page frontend/src/routes/ops.tsx with number tiles + one small chart; add "Operations" to the sidebar nav in AppSidebar.tsx.
- Done when: numbers match the real cases on screen.

B3. Approval rules (secures)
- Loans over $1M: a "not fraud" verdict needs a Senior sign-off before Close/Fund unlock (reuse `signOff` in hooks.ts and the Analyst/Senior switch in the sidebar).
- The Senior signing off can't be the analyst who made the verdict (compare names).
- Escalation sign-off on the Escalations page only for Senior role.
- Done when: tested with two different names in two browser tabs.

B4. Test: typecheck, click through every new screen, confirm changes sync across two tabs (~1 s).

# What runs in parallel
- A1, A2, A3 run at the same time as B1, B2, B3. No waiting on each other.
- Shared files and how not to collide:
  - Types files: A adds fields to Crux; B adds `stage` to Loan. Different lines — merges fine. Update BOTH copies.
  - case.$id.tsx: A only swaps the crux box (~line 90) for CreditMemo; B only edits the header (LifecycleBar) and decision box. Different sections.
  - Demo data (mockData.ts, sample-court.json): A only. B derives stages so it never edits demo data.
  - hooks.ts: B only (A may touch only `useCrux` if needed — tell B first).
- Order: A1 → A2 → A3 → A4. B1 → B2 → B3.
- Merge at 10:30 AM CST: B's branch into `backend` first, then A's; run the full demo once; push (ask first).

# After merging (together)
- Clear test data / reset the demo, pre-run the demo cases with the worker.
- Demo flow: submit a loan live → rules flag it → agents debate (~17 s) → credit memo → click a claim to light up the ring on the map → fact-checker hides a fake citation → analyst decides → Senior signs off → Close → Fund → Operations page.
- Devpost: rename to Paper Trail, add video link, schools, "≤3 sponsor challenges" checkbox; remove the "Predict next" claim unless built. Submit before 12:00 PM CST.
