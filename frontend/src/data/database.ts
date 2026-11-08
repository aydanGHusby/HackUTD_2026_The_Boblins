import { DbConnection } from "@/module_bindings";

type Snapshot = { revision: number; state: Record<string, unknown> };
export function connectDatabase(
  onSnapshot: (snapshot: Snapshot) => void,
  onStatus: (connected: boolean) => void,
  options: { uri?: string; database?: string } = {},
) {
  const uri = options.uri || import.meta.env["VITE_SPACETIMEDB_URI"] || "ws://127.0.0.1:3108";
  const database =
    options.database || import.meta.env["VITE_SPACETIMEDB_DATABASE"] || "fraudgraph-review";
  const key = `fraudgraph.db-token:${uri}:${database}`;
  let token: string | undefined;
  try {
    if (typeof localStorage !== "undefined") token = localStorage.getItem(key) || undefined;
  } catch {
    /* Storage may be disabled. Anonymous connection still works. */
  }
  let stopped = false;
  const publish = (row: { id: string; data: string; revision: number }) => {
    if (stopped || row.id !== "review") return;
    try {
      onSnapshot({ revision: row.revision, state: JSON.parse(row.data) });
      onStatus(true);
    } catch {
      onStatus(false);
    }
  };
  const connection = DbConnection.builder()
    .withUri(uri)
    .withDatabaseName(database)
    .withToken(token)
    .withCompression("none")
    .withAutomaticReconnect()
    .onConnect((connection, _identity, token) => {
      if (stopped) {
        connection.disconnect();
        return;
      }
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, token);
      } catch {
        /* Optional persistence. */
      }
      connection.db.dashboard.onInsert((_context, row) => publish(row));
      connection.db.dashboard.onUpdate((_context, _old, row) => publish(row));
      connection
        .subscriptionBuilder()
        .onApplied(() => {
          const row = connection.db.dashboard.id.find("review");
          if (row) publish(row);
          else onStatus(false);
        })
        .onError(() => onStatus(false))
        .subscribe("SELECT * FROM dashboard WHERE id = 'review'");
    })
    .onConnectError(() => {
      if (!stopped) onStatus(false);
    })
    .onDisconnect(() => {
      if (!stopped) onStatus(false);
    })
    .build();
  return () => {
    stopped = true;
    connection.disconnect();
  };
}
