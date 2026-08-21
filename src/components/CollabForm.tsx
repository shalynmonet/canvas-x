import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAY_FREQUENCIES,
  toISODate,
  warmupEndDate,
  type Collab,
} from "@/lib/canvas";

const schema = z.object({
  brand_name: z.string().trim().min(1, "Brand name is required").max(80),
  social_accounts: z.string().trim().max(200),
  start_date: z.string().min(10, "Pick a start date"),
  source: z.string().trim().max(80),
  main_poc: z.string().trim().max(80),
  warmup_days: z.number().int().min(2).max(5),
  daily_engagement_minutes: z.number().int().min(10).max(45),
  base_pay: z.number().min(0).max(1_000_000),
  cpm_rate: z.number().min(0).max(10_000),
  min_daily_posts: z.number().int().min(0).max(20),
  pay_frequency: z.enum(["weekly", "biweekly", "monthly", "on completion"]),
  status: z.enum(["active", "completed", "paused"]),
});

const ENGAGEMENT_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45];

export function CollabForm({
  collab,
  onSaved,
  onCancel,
}: {
  collab?: Collab;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({
    brand_name: collab?.brand_name ?? "",
    social_accounts: collab?.social_accounts ?? "",
    start_date: collab?.start_date ?? toISODate(new Date()),
    source: collab?.source ?? "",
    main_poc: collab?.main_poc ?? "",
    warmup_days: collab?.warmup_days ?? 3,
    daily_engagement_minutes: collab?.daily_engagement_minutes ?? 20,
    base_pay: Number(collab?.base_pay ?? 0),
    cpm_rate: Number(collab?.cpm_rate ?? 0),
    min_daily_posts: collab?.min_daily_posts ?? 1,
    pay_frequency: (collab?.pay_frequency ?? "monthly") as (typeof PAY_FREQUENCIES)[number],
    status: (collab?.status ?? "active") as "active" | "completed" | "paused",
  });

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("You are signed out");

      if (collab) {
        const { error } = await supabase.from("collabs").update(parsed.data).eq("id", collab.id);
        if (error) throw error;
        toast.success("Collab updated");
        void queryClient.invalidateQueries();
        onSaved(collab.id);
      } else {
        const { data, error } = await supabase
          .from("collabs")
          .insert({ ...parsed.data, user_id: auth.user.id })
          .select("id")
          .single();
        if (error) throw error;
        toast.success(
          `Collab added — warmup ends ${warmupEndDate(parsed.data.start_date, parsed.data.warmup_days)}`,
        );
        void queryClient.invalidateQueries();
        onSaved((data as { id: string }).id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const badge = (
    <span className="block min-h-[26px]">
      {match ? (
        <span className="inline-block rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
          Recommended based on {match.responseCount} creator response
          {match.responseCount === 1 ? "" : "s"} via Terac
        </span>
      ) : null}
    </span>
  );

  return (
    <form onSubmit={submit} className="space-y-5 pb-6">
      <Field label="Brand name" htmlFor="brand_name">
        <Input
          id="brand_name"
          value={values.brand_name}
          maxLength={80}
          onChange={(e) => set("brand_name", e.target.value)}
          required
        />
      </Field>

      <Field
        label="Designated social accounts"
        htmlFor="social_accounts"
        hint="Comma-separated, e.g. @main, @clips"
      >
        <Input
          id="social_accounts"
          value={values.social_accounts}
          maxLength={200}
          onChange={(e) => set("social_accounts", e.target.value)}
        />
      </Field>

      <Field label="Start date" htmlFor="start_date">
        <Input
          id="start_date"
          type="date"
          value={values.start_date}
          onChange={(e) => set("start_date", e.target.value)}
          required
        />
      </Field>

      <Field
        label="Source"
        htmlFor="source"
        hint="e.g. inbound DM, agency, referral, beauty brand outreach"
      >
        <Input
          id="source"
          value={values.source}
          maxLength={80}
          onChange={(e) => set("source", e.target.value)}
        />
      </Field>

      <Field label="Main POC" htmlFor="main_poc">
        <Input
          id="main_poc"
          value={values.main_poc}
          maxLength={80}
          onChange={(e) => set("main_poc", e.target.value)}
        />
      </Field>

      <Field label="Warmup timeframe" hint="Days of engagement before posting starts">
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((d) => (
            <Chip
              key={d}
              active={values.warmup_days === d}
              onClick={() => {
                setTouchedWarmup(true);
                set("warmup_days", d);
              }}
            >
              {d}d
            </Chip>
          ))}
        </div>
        {badge}
      </Field>

      <Field label="Daily engagement time once warmed up">
        <div className="flex flex-wrap gap-2">
          {ENGAGEMENT_OPTIONS.map((m) => (
            <Chip
              key={m}
              active={values.daily_engagement_minutes === m}
              onClick={() => {
                setTouchedWarmup(true);
                set("daily_engagement_minutes", m);
              }}
            >
              {m}m
            </Chip>
          ))}
        </div>
        {badge}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Base pay ($)" htmlFor="base_pay">
          <Input
            id="base_pay"
            type="number"
            min={0}
            step="0.01"
            value={values.base_pay}
            onChange={(e) => set("base_pay", Number(e.target.value))}
          />
        </Field>
        <Field label="CPM rate ($ / 1,000 views)" htmlFor="cpm_rate">
          <Input
            id="cpm_rate"
            type="number"
            min={0}
            step="0.01"
            value={values.cpm_rate}
            onChange={(e) => set("cpm_rate", Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Minimum daily posts" htmlFor="min_daily_posts">
        <Input
          id="min_daily_posts"
          type="number"
          min={0}
          max={20}
          value={values.min_daily_posts}
          onChange={(e) => set("min_daily_posts", Number(e.target.value))}
        />
        {badge}
      </Field>

      <Field label="Pay frequency" htmlFor="pay_frequency">
        <select
          id="pay_frequency"
          value={values.pay_frequency}
          onChange={(e) =>
            set("pay_frequency", e.target.value as (typeof PAY_FREQUENCIES)[number])
          }
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          {PAY_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>

      {collab && (
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            value={values.status}
            onChange={(e) => set("status", e.target.value as "active" | "completed" | "paused")}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
        </Field>
      )}

      <p className="text-xs text-muted-foreground">
        Warmup ends {warmupEndDate(values.start_date, values.warmup_days)}
      </p>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : collab ? "Save changes" : "Add collab"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chip({
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
