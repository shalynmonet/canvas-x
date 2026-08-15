import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useCalibration } from "@/hooks/use-canvas";
import { summarizeCalibration } from "@/lib/canvas";
import { distributeSurveyViaTerac } from "@/lib/terac.functions";

export const Route = createFileRoute("/_authenticated/calibration")({
  head: () => ({
    meta: [
      { title: "Recommendations — CanvasX" },
      {
        name: "description",
        content:
          "Creator-sourced recommendations for warmup length, daily engagement time and minimum daily posts on brand collabs.",
      },
      { property: "og:title", content: "Recommendations — CanvasX" },
      {
        property: "og:description",
        content: "Real creator averages that power CanvasX's suggested collab defaults.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <RecommendationsScreen />
    </AppShell>
  ),
});

function RecommendationsScreen() {
  const { data: rows = [] } = useCalibration();
  const distribute = useServerFn(distributeSurveyViaTerac);
  const [busy, setBusy] = useState(false);
  const summary = summarizeCalibration(rows);

  async function send() {
    setBusy(true);
    try {
      const result = await distribute({
        data: { surveyUrl: `${window.location.origin}/survey`, sampleSize: 40 },
      });
      if (result.ok) toast.success("Survey sent to Terac respondents");
      else toast.error(result.error ?? "Terac distribution failed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terac distribution failed");
    } finally {
      setBusy(false);
    }
  }

  const round = (n: number | null, step = 1) =>
    n === null ? null : Math.round(n / step) * step;

  const warmup = round(summary.warmupDays);
  const minutes = round(summary.engagementMinutes, 5);
  const posts = round(summary.minPosts);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recommendations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.responseCount === 0
            ? "No creator responses yet — collab defaults stay blank until the Terac survey returns."
            : `Summary of ${summary.responseCount} creator response${
                summary.responseCount === 1 ? "" : "s"
              } collected via Terac.`}
        </p>
      </div>

      <section className="card-surface p-4">
        <h2 className="text-base font-semibold">What creators recommend</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <Stat label="Warmup" value={warmup ? `${warmup}d` : "—"} />
          <Stat label="Engagement" value={minutes ? `${minutes}m` : "—"} />
          <Stat label="Min posts" value={posts !== null ? `${posts}` : "—"} />
        </dl>
        {summary.responseCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Creators warm up for about {summary.warmupDays?.toFixed(1)} days, then spend around{" "}
            {Math.round(summary.engagementMinutes ?? 0)} minutes a day engaging and post about{" "}
            {summary.minPosts?.toFixed(1)} times a day. New collabs are pre-filled with these
            numbers.
          </p>
        )}
      </section>

      <Button className="w-full" size="lg" disabled={busy} onClick={send}>
        {busy ? "Sending to Terac…" : "Distribute survey via Terac"}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-bold">{value}</dd>
    </div>
  );
}
