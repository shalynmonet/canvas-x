import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GENERAL_COLLAB_TYPE } from "@/lib/canvas";
import { submitSurveyResponse } from "@/lib/terac.functions";

export const Route = createFileRoute("/survey")({
  head: () => ({
    meta: [
      { title: "Creator collab survey — CanvasX" },
      {
        name: "description",
        content:
          "Three quick questions: how long you warm up, how long you engage daily and how many posts a day are sustainable on a brand collab.",
      },
      { property: "og:title", content: "Creator collab survey — CanvasX" },
      {
        property: "og:description",
        content: "Help calibrate realistic warmup, engagement and posting defaults for creators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SurveyPage,
});

const WARMUP = [2, 3, 4, 5];
const MINUTES = [10, 15, 20, 25, 30, 35, 40, 45];
const POSTS = [1, 2, 3, 4, 5];

function SurveyPage() {
  const submit = useServerFn(submitSurveyResponse);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warmupDays, setWarmupDays] = useState(3);
  const [engagementMinutes, setEngagementMinutes] = useState(20);
  const [minPosts, setMinPosts] = useState(2);

  async function finish() {
    setBusy(true);
    try {
      await submit({
        data: {
          answers: [
            {
              collab_type: GENERAL_COLLAB_TYPE,
              warmup_days: warmupDays,
              engagement_minutes: engagementMinutes,
              min_posts: minPosts,
            },
          ],
          respondent_source: "terac",
        },
      });
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-3xl font-bold">Thank you</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your answers now shape the recommendations other creators see in CanvasX.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-accent underline">
          See what CanvasX does
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Creator collab survey
      </p>
      <h1 className="mt-3 text-2xl font-bold">What actually works for you?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Three questions about how you run a brand collab. No brand-type sorting — just your rhythm.
      </p>

      <div className="mt-8 space-y-6">
        <Group label="Ideal warmup length (days)">
          {WARMUP.map((d) => (
            <Option key={d} active={warmupDays === d} onClick={() => setWarmupDays(d)}>
              {d}d
            </Option>
          ))}
        </Group>
        <Group label="Daily engagement time once warmed up">
          {MINUTES.map((m) => (
            <Option
              key={m}
              active={engagementMinutes === m}
              onClick={() => setEngagementMinutes(m)}
            >
              {m}m
            </Option>
          ))}
        </Group>
        <Group label="Sustainable minimum posts per day">
          {POSTS.map((p) => (
            <Option key={p} active={minPosts === p} onClick={() => setMinPosts(p)}>
              {p}
            </Option>
          ))}
        </Group>
      </div>

      <Button size="lg" className="mt-8 w-full" disabled={busy} onClick={finish}>
        {busy ? "Submitting…" : "Submit"}
      </Button>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
