import { createFileRoute, redirect } from "@tanstack/react-router";

// Old URL from the first prototype; the case list now lives at /.
export const Route = createFileRoute("/queue")({
  beforeLoad: () => { throw redirect({ to: "/cases" }); },
});
