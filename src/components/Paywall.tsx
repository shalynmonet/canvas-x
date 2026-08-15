import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OfferCountdown, useOfferCountdown } from "@/components/OfferCountdown";
import { createCheckoutSession } from "@/lib/billing.functions";
import { LIFETIME_PRICE_USD, YEARLY_PRICE_USD } from "@/lib/canvas";

type Plan = "yearly" | "lifetime";

export function UpgradeButton({
  label = "Upgrade to continue",
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
  "15-day view logging with live earnings estimates",
  "Accountability texts from the reminder agent",
];

export function PlanOptions() {
  const { live } = useOfferCountdown();

  return (
    <div className="space-y-4">
      {live && (
        <section className="card-surface space-y-3 border-accent/40 p-5 text-left">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">${LIFETIME_PRICE_USD} lifetime</h2>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Today only
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            One payment, forever access. No trial needed, no renewals — but only until the
            countdown hits zero.
          </p>
          <OfferCountdown />
          <UpgradeButton plan="lifetime" label={`Get lifetime access — $${LIFETIME_PRICE_USD}`} />
        </section>
      )}

      <section className="card-surface space-y-3 p-5 text-left">
        <h2 className="text-lg font-semibold">${YEARLY_PRICE_USD}/year</h2>
        <p className="text-sm text-muted-foreground">
          Start with a 7-day free trial, then ${YEARLY_PRICE_USD}/year. Cancel anytime.
        </p>
        <UpgradeButton
          plan="yearly"
          variant={live ? "outline" : "default"}
          label={`Start trial — $${YEARLY_PRICE_USD}/year`}
        />
      </section>
    </div>
  );
}

export function Paywall() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Choose your plan
      </p>
      <h1 className="text-3xl font-bold">Keep every collab on track</h1>
      <p className="text-sm text-muted-foreground">
        Your free trial covers the first 7 days. After that, ${YEARLY_PRICE_USD}/year — or just
        ${LIFETIME_PRICE_USD} for lifetime access while the launch offer is live.
      </p>
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
