import { connectDatabase } from "@/data/database";

// Native database subscription supplies the case state. SSE supplies reviewer presence
// and provides a durable-data fallback if a browser cannot connect directly to the DB.
export function connectWorkspace(
  user: string,
  caseId: string,
  onData: (data: any) => void,
  onError: (message: string) => void,
) {
  let native = false;
  let closed = false;
  let closeDatabase = () => {};
  try {
    closeDatabase = connectDatabase(
      (snapshot) => {
        if (!closed) onData({ type: "snapshot", ...snapshot });
      },
      (connected) => {
        native = connected;
        if (!closed) onData({ type: "transport", transport: connected ? "native" : "bridge" });
      },
    );
  } catch {
    onData({ type: "transport", transport: "bridge" });
  }
  const events = new EventSource(`/api/workspace/events?${new URLSearchParams({ user, caseId })}`);
  events.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "snapshot" && native) return;
      if (data.type === "snapshot") onData({ type: "transport", transport: "bridge" });
      onData(data);
    } catch {
      onError("A shared update could not be read. Reconnecting…");
    }
  };
  events.onerror = () =>
    onError(
      "Connecting to the backend… Start the backend on port 3112 and SpacetimeDB on port 3108.",
    );
  return () => {
    closed = true;
    events.close();
    closeDatabase();
  };
}
