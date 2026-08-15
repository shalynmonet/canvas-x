import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useCalibration } from "@/hooks/use-canvas";
import { distributeSurveyViaTerac } from "@/lib/terac.functions";

export const Route = createFileRoute("/_authenticated/calibration")({
  head: () => ({
    meta: [
      { title: "Calibration results — CanvasX" },
      {
        name: "description",
        content:
          "Creator-calibrated warmup, engagement and posting averages per collab type, powered by Terac respondents.",
      },
      { property: "og:title", content: "Calibration results — CanvasX" },
      {
        property: "og:description",
        content: "Real creator averages that power CanvasX's suggested collab defaults.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <CalibrationScreen />
    </AppShell>
  ),
});

function CalibrationScreen() {
  const { data: rows = [] } = useCalibration();
  const distribute = useServerFn(distributeSurveyViaTerac);
  const [busy, setBusy] = useState(false);

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

  const total = rows.reduce((sum, r) => sum + r.response_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calibration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {total === 0
            ? "No creator responses yet — collab defaults are blank/generic until the survey returns."
            : `${total} creator responses via Terac are now shaping suggested defaults.`}
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <section key={row.collab_type} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold capitalize">{row.collab_type}</h2>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                {row.response_count} response{row.response_count === 1 ? "" : "s"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Stat label="Warmup" value={row.avg_warmup_days ? `${row.avg_warmup_days}d` : "—"} />
              <Stat
                label="Engagement"
                value={row.avg_engagement_minutes ? `${row.avg_engagement_minutes}m` : "—"}
              />
              <Stat label="Min posts" value={row.avg_min_posts ? `${row.avg_min_posts}` : "—"} />
            </dl>
          </section>
        ))}
      </div>

      <div className="space-y-3">
        <Button className="w-full" size="lg" disabled={busy} onClick={send}>
          {busy ? "Sending to Terac…" : "Distribute survey via Terac"}
        </Button>
        <Link
          to="/survey"
          className="block text-center text-sm font-medium text-accent underline"
        >
          Open the survey yourself
        </Link>
      </div>
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
