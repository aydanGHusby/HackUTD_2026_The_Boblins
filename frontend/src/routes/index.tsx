import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessagesSquare, Radar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FraudGraph · See the network behind the loan" },
      { name: "description", content: "FraudGraph flags commercial loans with network problems, lets two agents argue both sides, and leaves the decision to a person with the evidence in front of them." },
      { property: "og:title", content: "FraudGraph · See the network behind the loan" },
      { property: "og:description", content: "Risk rules flag the loan, two agents argue both sides, you decide with the evidence in front of you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const points = [
  {
    icon: Radar,
    title: "Flagged automatically",
    body: "Risk rules run over every loan and pull out the ones with network problems: shared addresses, pledged collateral, the same director on two borrowers.",
  },
  {
    icon: MessagesSquare,
    title: "Argued from both sides",
    body: "Two agents build the case for and against, one claim at a time, and every claim has to point at real evidence to count.",
  },
  {
    icon: ShieldCheck,
    title: "Decided by you",
    body: "You record the verdict and the reason. The audit trail keeps who decided, when, and what they saw at the time.",
  },
];

function Landing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-candy text-on-candy glow-candy">
            <NetworkMark />
          </span>
          Fraud<span className="text-ocean">Graph</span>
        </div>
        <Link to="/cases" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          Open cases
        </Link>
      </header>

      <main className="flex flex-col items-center gap-12 py-14 lg:flex-row lg:gap-16 lg:py-20">
        <div className="max-w-xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-ocean">Fraud review, not fraud guessing</div>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            See the network<span className="text-candy-strong"> behind the loan.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            A flagged loan is rarely one bad borrower. It is a shared address, a warehouse pledged twice,
            the same director on two companies. FraudGraph lays the whole network on the table, has two
            agents argue both sides of it, and hands you the decision with the evidence still visible.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/cases">Get started <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/intake">Run a new loan</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Mock data for now — the screens are the point, not the numbers.
          </p>
        </div>

        <div className="liquid-glass w-full max-w-md rounded-3xl p-4 lg:max-w-lg">
          <NetworkFigure />
          <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-[11px] text-foreground/80">
            <span className="rounded-full bg-muted px-2 py-0.5">Loan</span>
            <span className="rounded-full bg-muted px-2 py-0.5">Borrower</span>
            <span className="rounded-full bg-muted px-2 py-0.5">Director</span>
            <span className="rounded-full bg-muted px-2 py-0.5">Collateral</span>
            <span className="ml-auto rounded-full bg-candy-soft px-2 py-0.5 font-semibold text-candy-strong">Flagged link</span>
          </div>
        </div>
      </main>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        {points.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="glass rounded-2xl p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/70 text-ocean">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-sm font-bold">{p.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          );
        })}
      </section>

      <footer className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
        <span>FraudGraph · every decision is logged with the analyst who made it and the reason they gave.</span>
        <Link to="/cases" className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground hover:text-ocean">
          Open cases <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </div>
  );
}

function NetworkMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="3" r="1.8" fill="currentColor" />
      <circle cx="3" cy="12" r="1.8" fill="currentColor" />
      <circle cx="13" cy="12" r="1.8" fill="currentColor" />
      <path d="M8 3 3 12M8 3l5 9M3 12h10" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </svg>
  );
}

/** Decorative network figure: the shape of what the case page actually shows. */
function NetworkFigure() {
  return (
    <svg viewBox="0 0 520 400" className="h-auto w-full" aria-hidden="true">
      <defs>
        <radialGradient id="lg-aura">
          <stop offset="0%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0.34 }} />
          <stop offset="65%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0.08 }} />
          <stop offset="100%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <circle cx="260" cy="205" r="180" fill="url(#lg-aura)" />
      <circle cx="260" cy="205" r="58" className="fill-none stroke-glow-ocean/30" strokeWidth="1.5" />
      <circle cx="260" cy="205" r="42" className="fill-none stroke-glow-ocean/60 graph-pulse" strokeWidth="2" />

      <g className="stroke-muted-foreground/40" strokeWidth="1.4">
        <line x1="120" y1="110" x2="392" y2="96" />
        <line x1="120" y1="110" x2="404" y2="286" />
        <line x1="112" y1="318" x2="260" y2="205" />
        <line x1="404" y1="286" x2="260" y2="205" />
        <line x1="120" y1="110" x2="260" y2="205" />
      </g>
      <line x1="392" y1="96" x2="404" y2="286" className="stroke-candy-strong halo-candy graph-flow" strokeWidth="2.5" strokeDasharray="8 6" />

      <g>
        <circle cx="260" cy="205" r="24" className="fill-node-loan stroke-background" strokeWidth="3" />
        <text x="260" y="210" textAnchor="middle" className="fill-primary-foreground text-[13px] font-bold">L</text>
      </g>
      <g>
        <circle cx="120" cy="110" r="17" className="fill-node-person stroke-background" strokeWidth="3" />
        <text x="120" y="115" textAnchor="middle" className="fill-primary-foreground text-[12px] font-bold">P</text>
      </g>
      <g>
        <circle cx="392" cy="96" r="17" className="fill-node-company stroke-background" strokeWidth="3" />
        <text x="392" y="101" textAnchor="middle" className="fill-primary-foreground text-[12px] font-bold">C</text>
      </g>
      <g>
        <circle cx="404" cy="286" r="17" className="fill-node-company stroke-background" strokeWidth="3" />
        <text x="404" y="291" textAnchor="middle" className="fill-primary-foreground text-[12px] font-bold">C</text>
      </g>
      <g>
        <circle cx="112" cy="318" r="17" className="fill-node-collateral stroke-background" strokeWidth="3" />
        <text x="112" y="323" textAnchor="middle" className="fill-primary-foreground text-[12px] font-bold">A</text>
      </g>

      <text x="260" y="252" textAnchor="middle" className="fill-foreground text-[12px] font-medium">L-1001</text>
      <text x="120" y="145" textAnchor="middle" className="fill-foreground text-[12px] font-medium">Director</text>
      <text x="392" y="131" textAnchor="middle" className="fill-foreground text-[12px] font-medium">Borrower</text>
      <text x="404" y="321" textAnchor="middle" className="fill-foreground text-[12px] font-medium">Borrower</text>
      <text x="112" y="353" textAnchor="middle" className="fill-foreground text-[12px] font-medium">Collateral</text>
      <text x="418" y="196" textAnchor="middle" strokeWidth="5" strokeLinejoin="round" className="fill-canvas stroke-canvas text-[11px] font-semibold">same address</text>
      <text x="418" y="196" textAnchor="middle" className="fill-candy-strong text-[11px] font-semibold">same address</text>
    </svg>
  );
}
