# Paper Trail shared local case

The running implementation is the TypeScript module in `src/index.ts`. The earlier `schema.rs` is a design sketch and is not used.

SpacetimeDB 2.14.1 is installed in the ignored `.local-spacetime` folder. Its persistent database runs on `127.0.0.1:3108`, with database name `fraudgraph-local`.

## Run

From the project root, start the database in one terminal:

```sh
npm run db:start
```

Only for initial creation or a module update, use another terminal:

```sh
npm run db:publish
```

Then start the app:

```sh
npm run dev
```

The app defaults to http://localhost:3000. Open the same URL in two tabs. Add a case note or change a decision in one tab. Both update. Refresh a tab or restart the app/database to verify persistence. The connection indicator counts actual open browser streams, not authenticated people.

## Implementation

The public `dashboard` table stores a single synthetic case snapshot. The private `applied_action` table prevents a retried action from being applied twice. The `apply_action` reducer updates case state and its audit entry in one transaction. Notes, account decisions, simulated holds, transfers, AI reports, and predictions are shared. Graph coordinates, selected account, and filters remain local to each view.

The Node server calls SpacetimeDB's HTTP reducer and SQL APIs. It sends committed updates to browsers with SSE and polls database revisions once per second for changes made through other app processes. This is a real database integration with an HTTP/SSE bridge, not a native browser SDK subscription.

Demo transfers represent observed events, not bank transfers or balance settlement. A simulated hold rejects newly submitted outgoing demo transfers. No real bank is connected, and no SAR is filed. Scenarios select existing accounts without replacing shared decisions.

This local synthetic demo has anonymous reducer access and listens only on loopback. Remote hosting needs an authenticated database connection and separate server deployment. The previous hosted Finch URL does not run this Node bridge.

## Verification

With database and app running:

```sh
TEST_ORIGIN=http://localhost:3000 npm run test:shared
```

Checks two event streams, shared notes, idempotent retry, concurrent writes, shared account decisions, held-account transfer rejection, and cross-origin write rejection. The test adds clearly labeled verification notes to the demo case.
