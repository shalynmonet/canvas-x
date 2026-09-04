import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CollabForm } from "@/components/CollabForm";
import {
  collabPlatforms,
  isInWarmup,
  money,
  platformLabel,
  toISODate,
  warmupEndDate,
  type Collab,
} from "@/lib/canvas";
import {
  draftToCollab,
  saveDemoCollab,
  type DemoCollabDraft,
  type DemoCollabFields,
} from "@/lib/demo-collab";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Try CanvOps free — live demo of the collab tracker" },
      {
        name: "description",
        content:
          "Add a real brand deal and see how CanvOps tracks warmup timing, the daily checklist and your earnings estimate. Nothing saves until you're ready.",
      },
      { property: "og:title", content: "Try CanvOps before you sign up" },
      {
        property: "og:description",
        content:
          "Enter a brand deal and watch CanvOps track warmup, daily checklist and earnings live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const [draft, setDraft] = useState<DemoCollabDraft | null>(null);

  function handlePreview(fields: DemoCollabFields, platformRates: Record<string, number>) {
    setDraft(saveDemoCollab(fields, platformRates));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <Logo to="/" />
        <a href="/auth" className="text-sm font-medium text-accent">
          Sign in
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24">
        {draft ? (
          <DemoDashboard draft={draft} onEdit={() => setDraft(null)} />
        ) : (
          <>
            <h1 className="text-3xl font-bold">Try it before you sign up</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Add a real brand deal below and see exactly how Canvas tracks it, warmup timing,
              daily checklist, and earnings estimate. Nothing saves until you're ready.
            </p>
            <div className="mt-8">
              <CollabForm
                onSaved={() => {}}
                onPreview={handlePreview}
                submitLabel="See it tracked"
                footerNote="This is a live preview. Your info won't be saved unless you choose to keep it."
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function DemoDashboard({
  draft,
  onEdit,
}: {
  draft: DemoCollabDraft;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const collab = draftToCollab(draft);
  const today = toISODate(new Date());

  function keepIt() {
    saveDemoCollab(draft.fields, draft.platformRates);
    void navigate({ to: "/auth", search: { demo: "1" } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Here's your deal, tracked.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This is what Canvas looks like once it's live. Want to keep this and start tracking it
          for real?
        </p>
      </div>

      <ChecklistCard collab={collab} today={today} />
      <EarningsCard collab={collab} draft={draft} />

      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={keepIt}>
          Save this collab
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={onEdit}>
          Change the details
        </Button>
      </div>
    </div>
  );
}

function ChecklistCard({ collab, today }: { collab: Collab; today: string }) {
  const warmup = isInWarmup(collab, today);
  const [warmedUp, setWarmedUp] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [posts, setPosts] = useState(0);
  const platforms = collabPlatforms(collab);

  return (
    <section className="card-surface space-y-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{collab.brand_name}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">Today</span>
      </div>
      {platforms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {platforms.map(platformLabel).join(" · ")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {warmup
          ? `Warmup phase — ends ${warmupEndDate(collab.start_date, collab.warmup_days)}`
          : `Posting phase — ${collab.min_daily_posts} deliverable${collab.min_daily_posts === 1 ? "" : "s"} per day`}
      </p>

      <div className="space-y-2">
        {warmup ? (
          <CheckRow
            label={`Warm up the account (${collab.daily_engagement_minutes} min)`}
            checked={warmedUp}
            onToggle={() => setWarmedUp((v) => !v)}
          />
        ) : (
          <>
            <CheckRow
              label={`Engage for ${collab.daily_engagement_minutes} min`}
              checked={engaged}
              onToggle={() => setEngaged((v) => !v)}
            />
            {Array.from({ length: Math.max(collab.min_daily_posts, 0) }, (_, i) => (
              <CheckRow
                key={i}
                label={`Deliverable ${i + 1} posted`}
                checked={posts > i}
                onToggle={() => setPosts(posts > i ? i : i + 1)}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left text-sm hover:bg-secondary"
    >
      {checked ? (
        <CheckCircle2 className="size-5 shrink-0 text-accent" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground" />
      )}
      <span className={checked ? "line-through text-muted-foreground" : ""}>{label}</span>
    </button>
  );
}

function EarningsCard({ collab, draft }: { collab: Collab; draft: DemoCollabDraft }) {
  const platforms = collabPlatforms(collab);
  return (
    <section className="card-surface space-y-3 p-5">
      <h2 className="text-lg font-semibold">Earnings estimate</h2>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Base pay</span>
        <span className="font-semibold">{money(Number(collab.base_pay))}</span>
      </div>
      <div className="space-y-1 text-sm">
        {collab.same_cpm_for_all_platforms ? (
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">CPM rate</span>
            <span>{money(Number(collab.cpm_rate))} / 1,000 views</span>
          </div>
        ) : (
          platforms.map((p) => (
            <div key={p} className="flex items-baseline justify-between">
              <span className="text-muted-foreground">{platformLabel(p)} CPM</span>
              <span>{money(draft.platformRates[p] ?? 0)} / 1,000 views</span>
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Views are paid over {collab.view_window_days} days
        {collab.min_views_for_payout > 0
          ? `, with a ${collab.min_views_for_payout.toLocaleString()}-view minimum per post`
          : ""}
        {collab.has_per_post_bonus
          ? `. Posts over ${collab.per_post_bonus_view_threshold.toLocaleString()} views add a ${money(Number(collab.per_post_bonus_amount))} bonus`
          : ""}
        . Log each post's views and this total updates live.
      </p>
    </section>
  );
}
