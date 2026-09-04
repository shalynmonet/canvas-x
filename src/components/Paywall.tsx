import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OfferCountdown, useOfferCountdown } from "@/components/OfferCountdown";
import { createCheckoutSession } from "@/lib/billing.functions";
import { LIFETIME_PRICE_USD, MONTHLY_PRICE_USD, YEARLY_PRICE_USD } from "@/lib/canvas";
import { readDemoCollab } from "@/lib/demo-collab";

type Plan = "monthly" | "yearly" | "lifetime";

export function UpgradeButton({
  label = "Continue",
  plan = "yearly",
  variant = "default",
  autoStart = false,
}: {
  label?: string;
  plan?: Plan;
  variant?: "default" | "outline";
  autoStart?: boolean;
}) {
  const checkout = useServerFn(createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  async function start() {
    setLoading(true);
    try {
      // Checkout runs as the signed-in user, so make sure there is a session first.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = `/auth?plan=${plan}`;
        return;
      }
      const { url } = await checkout({ data: { origin: window.location.origin, plan } });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open checkout");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <Button
      size="lg"
      variant={variant}
      className="w-full"
      disabled={loading}
      onClick={start}
    >
      {loading ? "Opening Stripe…" : label}
    </Button>
  );
}


const perks = [
  "Unlimited collabs with calibrated defaults",
  "Daily warmup, engagement and post checklists",
  "Cycle view logging with live earnings estimates",
  "Accountability emails from the reminder agent",
];

export function PlanOptions() {
  const { live } = useOfferCountdown();
  const [autoPlan, setAutoPlan] = useState<Plan | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") !== "1") return;
    const plan = params.get("plan");
    if (plan === "lifetime" || plan === "yearly" || plan === "monthly") setAutoPlan(plan);
  }, []);

  return (
    <div className="space-y-4">
      {live && (
        <section className="card-surface space-y-3 border-accent/40 p-5 text-left">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">${LIFETIME_PRICE_USD} lifetime</h2>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Limited time
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Limited time: ${LIFETIME_PRICE_USD} lifetime access, no renewals, ever.
          </p>
          <OfferCountdown />
          <UpgradeButton
            plan="lifetime"
            autoStart={autoPlan === "lifetime"}
            label={`Get lifetime access — $${LIFETIME_PRICE_USD}`}
          />
        </section>
      )}

      <section className="card-surface space-y-3 p-5 text-left">
        <h2 className="text-lg font-semibold">${YEARLY_PRICE_USD}/year</h2>
        <p className="text-sm text-muted-foreground">Save over paying monthly.</p>
        <UpgradeButton
          plan="yearly"
          autoStart={autoPlan === "yearly"}
          variant={live ? "outline" : "default"}
          label={`Choose yearly — $${YEARLY_PRICE_USD}/year`}
        />
      </section>

      <section className="card-surface space-y-3 p-5 text-left">
        <h2 className="text-lg font-semibold">${MONTHLY_PRICE_USD}/month</h2>
        <p className="text-sm text-muted-foreground">Cancel anytime.</p>
        <UpgradeButton
          plan="monthly"
          autoStart={autoPlan === "monthly"}
          variant="outline"
          label={`Choose monthly — $${MONTHLY_PRICE_USD}/month`}
        />
      </section>
    </div>
  );
}

export function Paywall() {
  const [hasDemo, setHasDemo] = useState(false);
  useEffect(() => setHasDemo(readDemoCollab() !== null), []);

  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Pick what fits
      </p>
      <h1 className="text-3xl font-bold">Choose your plan</h1>
      {hasDemo && (
        <p className="text-sm text-muted-foreground">
          Your collab is saved and waiting — it lands in your dashboard the moment payment
          clears, nothing to re-enter.
        </p>
      )}
      <ul className="card-surface space-y-2 p-5 text-left text-sm">
        {perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      <PlanOptions />
      <p className="text-xs text-muted-foreground">
        Access unlocks automatically the moment Stripe confirms payment.
      </p>
    </div>
  );
}
