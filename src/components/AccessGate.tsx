import type { ReactNode } from "react";
import { Paywall } from "@/components/Paywall";
import { useProfile } from "@/hooks/use-canvas";
import { hasAccess } from "@/lib/canvas";

export function AccessGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!hasAccess(profile)) return <Paywall />;

  return <>{children}</>;
}
