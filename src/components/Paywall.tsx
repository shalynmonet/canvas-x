import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/billing.functions";
import { MONTHLY_PRICE_USD } from "@/lib/canvas";

export function UpgradeButton({ label = "Upgrade to continue" }: { label?: string }) {
  const checkout = useServerFn(createCheckoutSession);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const { url } = await checkout({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open checkout");
      setLoading(false);
    }
  }

  return (
    <Button size="lg" className="w-full" disabled={loading} onClick={start}>
      {loading ? "Opening Stripe…" : label}
    </Button>
  );
}

export function Paywall() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Trial ended
      </p>
      <h1 className="text-3xl font-bold">Upgrade to continue</h1>
      <p className="text-sm text-muted-foreground">
        Your 7-day free trial is over. Keep every brand deal, daily checklist and earnings
        estimate in one place for ${MONTHLY_PRICE_USD}/month. Cancel anytime.
      </p>
      <ul className="card-surface space-y-2 p-5 text-left text-sm">
        <li>Unlimited collabs with calibrated defaults</li>
        <li>Daily warmup, engagement and post checklists</li>
        <li>15-day view logging with live earnings estimates</li>
        <li>Accountability texts from the reminder agent</li>
      </ul>
      <UpgradeButton />
      <p className="text-xs text-muted-foreground">
        Access unlocks automatically the moment Stripe confirms payment.
      </p>
    </div>
  );
}
