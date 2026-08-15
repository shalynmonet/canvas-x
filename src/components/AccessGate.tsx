import type { ReactNode } from "react";
import { Paywall } from "@/components/Paywall";
import { useProfile } from "@/hooks/use-canvas";
import { hasAccess, trialDaysLeft } from "@/lib/canvas";

export function AccessGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!hasAccess(profile)) return <Paywall />;

  const days = profile && profile.subscription_status === "trialing" ? trialDaysLeft(profile) : null;

  return (
    <>
      {days !== null && (
        <p className="mb-4 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground">
          Free trial — {days} day{days === 1 ? "" : "s"} left
        </p>
      )}
      {children}
    </>
  );
}
