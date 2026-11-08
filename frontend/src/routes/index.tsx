import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessagesSquare, Radar, ShieldCheck } from "lucide-react";
import { AppearancePicker } from "@/components/AppearancePicker";
import { BrandLogo } from "@/components/Mascot";
import { NetworkStory } from "@/components/NetworkStory";
import { MotionReveal } from "@/components/MotionReveal";
import { ReviewEntry } from "@/components/ReviewEntry";
import { setIdentity } from "@/data/identity";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paper Trail · See the network behind the loan" },
      {
        name: "description",
        content:
          "Paper Trail flags commercial loans with network problems, lets two agents argue both sides, and leaves the decision to a person with the evidence in front of them.",
      },
      { property: "og:title", content: "Paper Trail · See the network behind the loan" },
      {
        property: "og:description",
        content:
          "Risk rules flag the loan, two agents argue both sides, you decide with the evidence in front of you.",
      },
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
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/"
          aria-label="Paper Trail home"
          className="flex items-center gap-2 rounded-lg text-lg font-extrabold tracking-tight"
        >
          <BrandLogo size={46} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <AppearancePicker />
          </div>
          <Link
            to="/cases"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Open cases
          </Link>
        </div>
      </header>

      <main className="flex flex-col items-center gap-12 py-14 lg:flex-row lg:gap-16 lg:py-20">
        <MotionReveal className="max-w-xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-ocean">
            Fraud review, not fraud guessing
          </div>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            See the network<span className="text-candy-strong"> behind the loan.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            A flagged loan is rarely one bad borrower. It is a shared address, a warehouse pledged
            twice, the same director on two companies. Paper Trail lays the whole network on the
            table, has two agents argue both sides of it, and hands you the decision with the
            evidence still visible.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <a href="#review-entry">
                Get started <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/intake">Run a new loan</Link>
            </Button>
          </div>
          <ReviewEntry
            onEnter={(identity) => {
              setIdentity(identity);
              navigate({ to: identity.role === "senior_reviewer" ? "/escalations" : "/cases" });
            }}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Synthetic financial records stored in SpacetimeDB. AI reviews run through NVIDIA
            Nemotron when configured.
          </p>
        </MotionReveal>

        <MotionReveal delay={180} className="w-full max-w-lg lg:min-w-[430px]">
          <NetworkStory />
        </MotionReveal>
      </main>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        {points.map((p) => {
          const Icon = p.icon;
          return (
            <MotionReveal key={p.title} className="glass motion-card rounded-2xl p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/70 text-ocean">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-sm font-bold">{p.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </MotionReveal>
          );
        })}
      </section>

      <footer className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
        <span>
          Paper Trail · every decision is logged with the analyst who made it and the reason they
          gave.
        </span>
        <Link
          to="/cases"
          className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground hover:text-ocean"
        >
          Open cases <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </div>
  );
}
