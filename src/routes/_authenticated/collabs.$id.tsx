import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { CollabForm } from "@/components/CollabForm";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCollab, useCollabLogs, useViewLogs } from "@/hooks/use-canvas";
import {
  dayNumber,
  estimatedEarnings,
  isInWarmup,
  money,
  toISODate,
  warmupEndDate,
} from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/collabs/$id")({
  head: () => ({
    meta: [
      { title: "Collab detail — CanvasX" },
      {
        name: "description",
        content:
          "Edit collab terms, review your daily history, log 15-day views and see live earnings estimates.",
      },
      { property: "og:title", content: "Collab detail — CanvasX" },
      {
        property: "og:description",
        content: "Terms, history, 15-day views and estimated earnings for one brand deal.",
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

function CollabDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: collab, isLoading } = useCollab(id);
  const { data: logs = [] } = useCollabLogs(id);
  const { data: views = [] } = useViewLogs(id);
  const [tab, setTab] = useState<"views" | "history" | "edit">("views");

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

  const today = toISODate(new Date());
  const elapsedDays = Math.min(15, Math.max(0, dayNumber(collab.start_date, today)));
  const earnings = estimatedEarnings(collab, views);
  const viewByDay = new Map(views.map((v) => [v.day_number, v]));

  async function saveViews(day: number, count: number) {
    const existing = viewByDay.get(day);
    const { error } = await supabase.from("view_logs").upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        collab_id: id,
        day_number: day,
        view_count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0,
      },
      { onConflict: "collab_id,day_number" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["view_logs", id] });
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
      </div>

      <section className="card-surface bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
          Estimated earnings
        </p>
        <p className="mt-1 font-display text-4xl font-bold">{money(earnings)}</p>
        <p className="mt-2 text-xs opacity-70">
          Estimate only — {money(Number(collab.base_pay))} base +{" "}
          {views.reduce((s, v) => s + v.view_count, 0).toLocaleString()} logged views at{" "}
          {money(Number(collab.cpm_rate))}/1,000. Final payout comes from the brand.
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
            {t === "views" ? "15-day views" : t}
          </button>
        ))}
      </div>

      {tab === "views" && (
        <section className="space-y-2">
          {elapsedDays < 1 && (
            <p className="text-sm text-muted-foreground">
              View slots unlock once the collab start date arrives.
            </p>
          )}
          {Array.from({ length: elapsedDays }, (_, i) => i + 1).map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="w-16 text-xs font-semibold text-muted-foreground">
                Day {day}
              </span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={viewByDay.get(day)?.view_count ?? ""}
                placeholder="views"
                onBlur={(e) => saveViews(day, Number(e.target.value))}
              />
            </div>
          ))}
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

      {tab === "edit" && <CollabForm collab={collab} onSaved={() => setTab("views")} />}
    </div>
  );
}
