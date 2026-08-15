import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { UpgradeButton } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-canvas";
import { syncSubscription } from "@/lib/billing.functions";
import { MONTHLY_PRICE_USD, trialDaysLeft } from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & reminders — CanvasX" },
      {
        name: "description",
        content: "Manage your reminder text time, phone number and CanvasX subscription.",
      },
      { property: "og:title", content: "Settings & reminders — CanvasX" },
      {
        property: "og:description",
        content: "Reminder time, phone number and subscription controls.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsScreen />
    </AppShell>
  ),
});

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+0-9()\-.\s]*$/, "Digits, spaces and + only"),
  reminder_time: z.string().max(5),
  reminder_enabled: z.boolean(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
});

function SettingsScreen() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const sync = useServerFn(syncSubscription);
  const [values, setValues] = useState({
    name: "",
    phone: "",
    reminder_time: "",
    reminder_enabled: false,
    timezone: "UTC",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setValues({
      name: profile.name,
      phone: profile.phone ?? "",
      reminder_time: profile.reminder_time ? profile.reminder_time.slice(0, 5) : "",
      reminder_enabled: profile.reminder_enabled,
      timezone: profile.timezone || detectTimezone(),
    });
  }, [profile]);

  useEffect(() => {
    if (profile?.stripe_subscription_id) {
      sync({ data: undefined })
        .then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.stripe_subscription_id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        reminder_time: parsed.data.reminder_time || null,
        reminder_enabled: parsed.data.reminder_time ? parsed.data.reminder_enabled : false,
        timezone: parsed.data.timezone || "UTC",
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      <form onSubmit={save} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={values.name}
            maxLength={80}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={values.phone}
            maxLength={20}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Reminders text this number only — it's your own accountability nudge.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminder_time">Reminder time</Label>
          <Input
            id="reminder_time"
            type="time"
            value={values.reminder_time}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                reminder_time: e.target.value,
                reminder_enabled: e.target.value ? true : v.reminder_enabled,
              }))
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Daily reminder texts</p>
            <p className="text-xs text-muted-foreground">
              Only sent when something is still unchecked.
            </p>
          </div>
          <Switch
            checked={values.reminder_enabled}
            onCheckedChange={(checked) =>
              setValues((v) => ({ ...v, reminder_enabled: checked }))
            }
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </form>

      <section className="card-surface space-y-3 p-5">
        <h2 className="text-lg font-semibold">Subscription</h2>
        {profile && (
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{profile.subscription_status}</span>
            {profile.subscription_status === "trialing" &&
              ` — ${trialDaysLeft(profile)} day(s) of trial left`}
          </p>
        )}
        {profile?.subscription_status !== "active" && (
          <UpgradeButton label={`Subscribe — $${MONTHLY_PRICE_USD}/mo`} />
        )}
      </section>
    </div>
  );
}
