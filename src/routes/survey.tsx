import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COLLAB_TYPES } from "@/lib/canvas";
import { submitSurveyResponse } from "@/lib/terac.functions";

export const Route = createFileRoute("/survey")({
  head: () => ({
    meta: [
      { title: "Creator collab survey — CanvasX" },
      {
        name: "description",
        content:
          "Four quick questions: how long you warm up, how long you engage daily and how many posts a day are sustainable per brand type.",
      },
      { property: "og:title", content: "Creator collab survey — CanvasX" },
      {
        property: "og:description",
        content: "Help calibrate realistic warmup, engagement and posting defaults for creators.",
      },
    ],
  }),
  component: SurveyPage,
});

const WARMUP = [2, 3, 4, 5];
const MINUTES = [10, 15, 20, 25, 30, 35, 40, 45];
const POSTS = [1, 2, 3, 4, 5];

type Answer = { warmup_days: number; engagement_minutes: number; min_posts: number };

function SurveyPage() {
  const submit = useServerFn(submitSurveyResponse);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(
      COLLAB_TYPES.map((t) => [t, { warmup_days: 3, engagement_minutes: 20, min_posts: 2 }]),
    ),
  );

  const type = COLLAB_TYPES[step]!;
  const current = answers[type]!;
  const isLast = step === COLLAB_TYPES.length - 1;

  function set(patch: Partial<Answer>) {
    setAnswers((a) => ({ ...a, [type]: { ...a[type]!, ...patch } }));
  }

  async function finish() {
    setBusy(true);
    try {
      await submit({
        data: {
          answers: COLLAB_TYPES.map((t) => ({ collab_type: t, ...answers[t]! })),
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
          Your answers now shape the suggested defaults other creators see in CanvasX.
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
        Question {step + 1} of {COLLAB_TYPES.length}
      </p>
      <h1 className="mt-3 text-2xl font-bold capitalize">{type}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        For a collab with this kind of brand, what actually works for you?
      </p>

      <div className="mt-8 space-y-6">
        <Group label="Ideal warmup length (days)">
          {WARMUP.map((d) => (
            <Option
              key={d}
              active={current.warmup_days === d}
              onClick={() => set({ warmup_days: d })}
            >
              {d}d
            </Option>
          ))}
        </Group>
        <Group label="Daily engagement time once warmed up">
          {MINUTES.map((m) => (
            <Option
              key={m}
              active={current.engagement_minutes === m}
              onClick={() => set({ engagement_minutes: m })}
            >
              {m}m
            </Option>
          ))}
        </Group>
        <Group label="Sustainable minimum posts per day">
          {POSTS.map((p) => (
            <Option key={p} active={current.min_posts === p} onClick={() => set({ min_posts: p })}>
              {p}
            </Option>
          ))}
        </Group>
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          disabled={busy}
          onClick={() => (isLast ? finish() : setStep(step + 1))}
        >
          {isLast ? (busy ? "Submitting…" : "Submit") : "Next"}
        </Button>
      </div>
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
