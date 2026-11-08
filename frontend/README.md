# Paper View frontend

Paper View uses the canonical `backend` branch's loan data, agent server functions, lifecycle and approval rules. The interface has a two-panel courtroom: network/evidence/summary/history on the left; live agent discussion and the human decision on the right. The sidebar also opens the case queue, intake, senior escalations, and Operations.

## Run locally

From the repository root, run `npm run dev:app` and keep that terminal open, then visit `http://127.0.0.1:3111/`. The local database runs on 3108, the retained account-demo Node server on 3112, and the TanStack frontend on 3111. The courtroom's server functions run within the frontend server and use the database directly through HTTP. The browser polls the shared loan snapshot using `src/data/spacetime.ts` and the canonical hooks in `src/data/hooks.ts`.

Configure `SPACETIMEDB_DATABASE=paper-view-courtroom` in the root `.env`; `NVIDIA_API_KEY` and `NVIDIA_MODEL` remain server-only. The local canonical module has been published to that separate database. Older `fraudgraph-local` and `fraudgraph-review` databases were preserved; their previous reviews were not migrated into the new courtroom seed. On another computer, install the module dependencies and local SpacetimeDB CLI, start the database, then publish the module as `paper-view-courtroom`. The backend's original publish/worker commands remain available.

The sidebar reports the backend's actual connection mode. The canonical backend uses demo data and local edits when offline. Demo names/roles are not authentication.

## Review a case

1. Choose a name and Analyst role, then open Cases. Select a loan to open the courtroom.
2. The network map supports drag/pan/zoom and citation highlighting. Expand Where they agree, Evidence, or History below it.
3. Run trial to call the backend's Nemotron agents. Opening and rebuttal rounds appear as they are recorded. Ask either agent a follow-up question or leave a team note. Verified-source badges check reference IDs, not independent truth.
4. Choose Fraud, Not fraud, or Escalate and enter reasoning. The canonical backend's decision semantics and audit behavior are retained.
5. The stage bar follows Applied → Checked → AI review → Decided → Closed → Funded → Monitored. A declined case stops on its decline branch. Stages do not advance on a timer.
6. Approved loans over $1M and escalated decisions require a senior sign-off. A different reviewer must sign off; the original analyst cannot approve their own decision. Once permitted, use Mark closed, then Fund loan. Funding proceeds to monitoring through the backend's existing actions.

## Interface details

Use **Appearance** in the sidebar or home-page header to choose White, Off-white, Cream, Light gray, Stone, Charcoal, Black, Dark slate, Soft blue, Mint, Lavender or Warm sand. Text, panels and the network canvas adapt to the selected background. Preferences save in this browser, restore before the first paint and synchronize between open tabs. Existing light/dark preferences are preserved on first use. Arrow keys navigate the palette choices.

The pixel mascot is the logo/favicon and appears in real loading states. The logo's paper-plane animation runs on hover or keyboard focus. Pastel background dots and subtle interface motion respect reduced-motion preferences. The artificial loading delay is disabled.

Ask questions within the case's Agent discussion to call the existing backend. The separate Ask AI drafting page has been removed.

## Validation

- `npm test --prefix frontend`: component and backend-workflow tests, including progress stages, approval gates and closing/funding transitions.
- `npm run worker:test`: canonical backend worker suite with stubbed model responses.
- `node scripts/verify-courtroom-backend.mjs`: real canonical database reducer test, isolated to a database ending in `-tests`. It verifies concurrent writes, idempotency and stage persistence.
- `npm run build --prefix frontend`: production build.

The old optional `database-live.test.ts` targets the previous bridge architecture and is skipped by default. Live NVIDIA quality and physical browser/projector visual QA must be checked separately; no live model call is made by the test suite.
