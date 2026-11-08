# Paper View Dashboard

Ok our project is Paper View. I attached a document of everything about it and an implementation plan. Let me know if this is enough information or if I should do more. With that, can we start building a frontend for it? like it doesn't have to be a perfect frotnend just a frontend to leach off of for now

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5ece5b9a-aa15-40ac-a6bc-e8c23f4868b0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Connected local workflow

The frontend now uses the local Node backend and SpacetimeDB. The records are synthetic. Names and the Analyst/Senior switch are demo identities, not authenticated bank roles.

From the repository root, use separate terminals:

For one-command startup from the repository root, run `npm run dev:app` and keep that terminal open. It reuses healthy local services and starts missing ones. Alternatively, use separate terminals:

1. `npm run db:start` — persistent SpacetimeDB on port 3108.
2. `npm run dev:api` — backend on port 3112, reads the root `.env`.
3. `npm run dev:ui` — this frontend on http://127.0.0.1:3111.

The `fraudgraph-review` database has already been created on this computer. For initial setup on another computer, install the SpacetimeDB CLI and module dependencies, then run `npm run db:publish:review` with the database running. This publishes without deleting existing data. The original `fraudgraph-local` account demo is separate.

For live NVIDIA requests, run the backend in your own terminal. Agent-run preview sessions may be blocked from accessing NVIDIA's endpoint.

### Use the app

- Open **Cases**, select an undecided case, then click **Run AI review**.
- Nemotron generates risk and legitimacy perspectives from saved graph records. The source badges establish that the cited record IDs exist, not that an assertion is independently proven.
- Ask either perspective a question or leave a team note. Failed AI questions remain visible with a retry control.
- Once the review is saved, record Fraud, Not fraud, or Escalate with your reason. These only change synthetic loan records.
- For an escalated case, select Senior in the demo identity controls and record a sign-off.
- Open New loan to submit a fictional application. Database rules flag duplicate collateral, large requests from recently registered companies, and requests over three times recorded revenue. Applications without flags remain in intake, not automatically approved.
- Open two tabs to see shared changes and actual case viewers. Reloading retains saved data.

`src/data/hooks.ts` is the frontend/backend adapter. Shared contracts in `src/shared/types.ts` remain unchanged. Development requests under `/api` are proxied to port 3112; hosting this frontend elsewhere requires a backend origin/proxy configuration too.

### Checks

- `npm test` and `npx tsc --noEmit` in `frontend/`.
- On Node 25, run tests with `NODE_OPTIONS=--no-experimental-webstorage npm test` to use jsdom's browser storage rather than Node's experimental storage.
- `scripts/verify-review.mjs` uses an isolated database ending in `-tests` and checks actual database updates and two SSE clients. AI output validation uses a stub provider to avoid network charges and keep results repeatable.


## Frontend review workflow

Open `http://127.0.0.1:3111/`, enter a name, and choose Analyst or Senior reviewer. Analysts open Cases; seniors open Escalations. These are demo profiles, not authenticated access controls.

- Cases are sorted by priority. Filter or search names and readable indicators. Use ↑ / ↓, Home / End, then Enter to open a case.
- Courtroom shows agreement and disputed questions first, then the two perspectives, a Cytoscape relationship map, supporting records, and review history. At narrower widths, perspectives move below the map.
- Click a source-backed statement or evidence record to highlight its exact citations. Unmatched citations keep a claim hidden behind an explanation. “Sources found” validates references, not the truth of a claim.
- Run AI review, ask a follow-up question, or save a team note. Errors preserve drafts. Pending questions can be retried.
- Request more information without closing a case. After an AI review, flag for investigation, dismiss the alert, or send for senior review. A senior can sign off inside the case or on Escalations. Decisions do not approve or decline an actual bank loan.
- **Score only** is the evaluation baseline. It hides the map and agent arguments and permits a decision on a queued case without calling NVIDIA. The audit records that this was a score-only decision. Use different cases/participants when comparing views; saved decisions cannot be silently overwritten.

The browser subscribes directly to the public `dashboard` row with the generated SpacetimeDB SDK bindings in `src/module_bindings/`. This deployed module stores the review workspace in one atomic JSON row, rather than separate `case_subgraph` tables. Presence and writes use the Node bridge; SSE also supplies actual database snapshots if a direct socket is unavailable. The sidebar distinguishes a native subscription from the bridge fallback. Optional public frontend configuration: `VITE_SPACETIMEDB_URI` and `VITE_SPACETIMEDB_DATABASE`. Do not place NVIDIA secrets in frontend variables.

Verification:

```sh
PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS=--no-experimental-webstorage npm test --prefix frontend
PATH=/opt/homebrew/bin:$PATH npm run build --prefix frontend
```

The optional native subscription integration test runs with `TEST_LIVE_DB=1`, a local database named `fraudgraph-review-tests`, and the test backend on port 3113. It checks two real WebSocket subscriptions receiving a committed change. Provider-stub backend tests do not establish live NVIDIA quality. A physical projector readability check is still required before the demo.

## Ask AI interface preview and interaction design

Open `/ask-ai` from the sidebar, or use **Ask AI** on a case to carry its context into the workspace. Suggested prompts fill the composer. Enter or the send button saves the question locally; Shift+Enter inserts a line break. The workspace keeps recent conversations and unsent drafts in this browser, with separate case context and a balanced/risk/legitimacy perspective selector. Changing the case after submitting a question starts another conversation. Storage failures are visible.

This tab is intentionally frontend-only: it never calls NVIDIA or generates answers. The “AI not connected” badge and reply placeholder make that explicit. The existing case-review AI flow is separate.

The landing page's illustrative network supports node selection, connection highlighting, three exploration steps and keyboard controls. Page entry, scroll reveals, cards, graph nodes and navigation use restrained motion inspired by the reference site's graph-focused presentation. Motion respects `prefers-reduced-motion`; no scrolling is hijacked. Manual browser/projector visual review remains pending.
