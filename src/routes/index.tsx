import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, MessageSquareDot, TrendingUp } from "lucide-react";
import { OfferCountdown } from "@/components/OfferCountdown";
import { LIFETIME_PRICE_USD, YEARLY_PRICE_USD } from "@/lib/canvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CanvasX — UGC collab organizer for creators" },
      {
        name: "description",
        content:
          "Track every brand deal in one daily checklist: warmup windows, engagement time, post counts, 15-day view logging and live earnings estimates.",
      },
      { property: "og:title", content: "CanvasX — UGC collab organizer for creators" },
      {
        property: "og:description",
        content:
          "One daily checklist for every brand deal — warmups, posts, views and payouts.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarCheck,
    title: "Check off today in seconds",
    body: "One card per collab: warmup, engagement time, and a box per required post.",
  },
  {
    icon: TrendingUp,
    title: "Know what you've earned",
    body: "Log 15-day views and see base pay plus CPM earnings update live.",
  },
  {
    icon: MessageSquareDot,
    title: "Reminders that name the gap",
    body: "A daily text tells you exactly which brand still needs posts today.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <span className="font-display text-lg font-bold">CanvasX</span>
        <Link to="/auth" className="text-sm font-medium text-accent">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          For UGC creators juggling brand deals
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl">
          Every collab, one checklist, checked off between takes.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          CanvasX keeps warmup windows, daily engagement, post minimums and payouts straight
          across all your brand deals — with defaults calibrated by real creators.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/auth"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start 7-day free trial
          </Link>
          <Link
            to="/survey"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Take the creator survey
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Then ${MONTHLY_PRICE_USD}/month. Cancel anytime.
        </p>

        <div className="mt-14 space-y-4">
          {features.map(({ icon: Icon, title, body }) => (
            <section key={title} className="card-surface flex gap-4 p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
