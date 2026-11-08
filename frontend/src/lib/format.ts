// Hand-rolled so server and browser render identical strings (Intl compact differs between runtimes).
export const money = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return `$${n}`;
};
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
export const riskTone = (score: number) => (score >= 80 ? "high" : score >= 50 ? "medium" : "low");
export const humanize = (s: string) => s.replace(/_/g, " ");
