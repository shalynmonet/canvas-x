import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { CollabForm } from "@/components/CollabForm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCollab, useCollabLogs, usePlatformRates, useViewEntries } from "@/hooks/use-canvas";
import {
  collabPlatforms,
  cpmForPlatform,
  entryEstimatedEarnings,
  entryHasViews,
  entryTotalViews,
  estimatedEarnings,
  isInWarmup,
  money,
  platformLabel,
  postEstimatedEarnings,
  warmupEndDate,
  type ViewEntry,
} from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/collabs/$id")({
  head: () => ({
    meta: [
      { title: "Collab detail — CanvasX" },
      {
        name: "description",
        content:
          "Edit collab terms, review your daily history, log per-post views and see live earnings estimates.",
      },
      { property: "og:title", content: "Collab detail — CanvasX" },
      {
        property: "og:description",
        content: "Terms, history, per-post views and estimated earnings for one brand deal.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <AccessGate>
        <CollabDetail />
      </AccessGate>
    </AppShell>
  ),
});

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function CollabDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: collab, isLoading } = useCollab(id);
  const { data: logs = [] } = useCollabLogs(id);
  const { data: entries = [] } = useViewEntries(id);
  const { data: rates = [] } = usePlatformRates(id);
  const [tab, setTab] = useState<"views" | "history" | "edit">("views");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  async function removeCollab() {
    setDeleting(true);
    try {
      await supabase.from("view_entries").delete().eq("collab_id", id);
      await supabase.from("daily_logs").delete().eq("collab_id", id);
      const { error } = await supabase.from("collabs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Collab removed");
      void queryClient.invalidateQueries();
      navigate({ to: "/home" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove collab");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!collab) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">This collab no longer exists.</p>
        <Link to="/home" className="text-sm font-medium text-accent">
          Back to today
        </Link>
      </div>
    );
  }

  const earnings = estimatedEarnings(collab, entries, rates);
  const loggedCount = entries.filter(entryHasViews).length;
  const platforms = collabPlatforms(collab);
  const minViews = Number(collab.min_views_for_payout);

  async function saveViews(entry: ViewEntry, raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Math.max(0, Math.round(Number(trimmed)));
    if (trimmed !== "" && !Number.isFinite(next)) {
      toast.error("Enter a valid view count");
      return;
    }
    if (next === entry.views) return;
    const { error } = await supabase
      .from("view_entries")
      .update({ views: next })
      .eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["view_entries", id] });
  }

  async function savePlatformViews(entry: ViewEntry, platform: string, raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Math.max(0, Math.round(Number(trimmed)));
    if (trimmed !== "" && !Number.isFinite(next)) {
      toast.error("Enter a valid view count");
      return;
    }
    const current = entry.platform_views ?? {};
    if ((current[platform] ?? null) === next) return;
    const platform_views = { ...current, [platform]: next };
    const { error } = await supabase
      .from("view_entries")
      .update({ platform_views })
      .eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["view_entries", id] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{collab.brand_name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Started {collab.start_date} · warmup ends{" "}
          {warmupEndDate(collab.start_date, collab.warmup_days)} · {collab.pay_frequency} ·{" "}
          {collab.status}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {collab.daily_engagement_minutes} min daily engagement · {collab.min_daily_posts} post
          {collab.min_daily_posts === 1 ? "" : "s"} per day · views paid for{" "}
          {collab.view_window_days} days per post · payout from{" "}
          {Number(collab.min_views_for_payout) === 0
            ? "any views"
            : `${Number(collab.min_views_for_payout).toLocaleString()} views`}
        </p>
        {!collab.same_cpm_for_all_platforms && rates.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Per-platform CPM:{" "}
            {rates
              .map((r) => `${platformLabel(r.platform)} ${money(Number(r.cpm_rate))}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <section className="card-surface bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
          Estimated earnings
        </p>
        <p className="mt-1 font-display text-4xl font-bold">{money(earnings)}</p>
        <p className="mt-2 text-xs opacity-70">
          Live estimate — {money(Number(collab.base_pay))} base + CPM on{" "}
          {entries.reduce((s, e) => s + entryTotalViews(e), 0).toLocaleString()} views logged across{" "}
          {loggedCount} of {entries.length} post{entries.length === 1 ? "" : "s"}.
          {Number(collab.min_views_for_payout) > 0 &&
            ` Posts under ${Number(collab.min_views_for_payout).toLocaleString()} views don’t qualify for CPM.`}{" "}
          Updates as more view counts are entered; final payout comes from the brand.
        </p>
      </section>

      <div className="flex gap-2">
        {(["views", "history", "edit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-10 flex-1 rounded-xl border text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-secondary"
            }`}
          >
            {t === "views" ? "Post views" : t}
          </button>
        ))}
      </div>

      {tab === "views" && (
        <section className="space-y-3">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No posts logged yet — check off a post on the Today dashboard and it will appear
              here with its own views target date.
            </p>
          )}
          {entries.map((entry) => {
            const perPlatform = entry.platform_views ?? {};
            const hasAny = entryHasViews(entry);
            const postTotal = entryEstimatedEarnings(entry, collab, rates);
            const hasPlatformValues = Object.values(perPlatform).some(
              (v) => v !== null && v !== undefined,
            );
            return (
              <div key={entry.id} className="card-surface space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Posted {formatDate(entry.post_date)}
                      {entry.post_index > 1 ? ` (post ${entry.post_index})` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Views entry opens {formatDate(entry.target_date)} ·{" "}
                      {entry.view_window_days}-day window
                    </p>
                  </div>
                  {hasAny && (
                    <span className="rounded-lg bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                      Est. {money(postTotal)}
                    </span>
                  )}
                </div>

                {platforms.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`views-entry-${entry.id}`}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Views
                    </label>
                    <Input
                      id={`views-entry-${entry.id}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Total views for post from ${entry.post_date}`}
                      defaultValue={entry.views ?? ""}
                      placeholder={`total views by ${formatDate(entry.target_date)}`}
                      onBlur={(e) => saveViews(entry, e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {platforms.map((platform) => {
                        const views = perPlatform[platform] ?? null;
                        const rate = cpmForPlatform(collab, rates, platform);
                        return (
                          <div key={platform} className="flex items-center gap-3">
                            <div className="w-24 shrink-0">
                              <label
                                htmlFor={`views-${entry.id}-${platform}`}
                                className="text-xs font-semibold"
                              >
                                {platformLabel(platform)}
                              </label>
                              <p className="text-[10px] text-muted-foreground">
                                {money(rate)} CPM
                              </p>
                            </div>
                            <Input
                              id={`views-${entry.id}-${platform}`}
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`${platformLabel(platform)} views for post from ${entry.post_date}`}
                              defaultValue={views ?? ""}
                              placeholder={`views by ${formatDate(entry.target_date)}`}
                              onBlur={(e) => savePlatformViews(entry, platform, e.target.value)}
                            />
                            <div className="w-24 shrink-0 text-right text-xs">
                              {views !== null &&
                                (views < minViews ? (
                                  <span className="text-muted-foreground">
                                    below {minViews.toLocaleString()} min
                                  </span>
                                ) : (
                                  <span className="font-semibold text-success">
                                    {money(postEstimatedEarnings(views, rate, minViews))}
                                  </span>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {entry.views !== null && !hasPlatformValues && (
                      <p className="text-xs text-muted-foreground">
                        Previously logged total: {entry.views.toLocaleString()} views
                      </p>
                    )}
                    {hasAny && (
                      <p className="border-t border-border pt-2 text-xs font-semibold">
                        Post total estimate: {money(postTotal)}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}

      {tab === "history" && (
        <section className="space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          )}
          {logs.map((log) => {
            const warmup = isInWarmup(collab, log.log_date);
            return (
              <div
                key={log.id}
                className="card-surface flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">{log.log_date}</span>
                <span className="text-muted-foreground">
                  {warmup
                    ? log.warmed_up
                      ? "Warmed up"
                      : "Warmup missed"
                    : `${log.engaged ? "Engaged" : "No engagement"} · ${log.posted_count}/${collab.min_daily_posts} posts`}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {tab === "edit" && (
        <>
          <CollabForm
            collab={collab}
            rates={rates}
            onSaved={() => setTab("views")}
            onCancel={() => setTab("views")}
          />
          <section className="card-surface space-y-3 p-5">
            <h2 className="text-sm font-semibold">Remove this collab</h2>
            <p className="text-xs text-muted-foreground">
              Deletes {collab.brand_name} along with its daily history and logged views. This
              can’t be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={deleting}>
                  {deleting ? "Removing…" : "Remove collab"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {collab.brand_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its checklist history and view entries will be deleted permanently.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={removeCollab}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </>
      )}
    </div>
  );
}
