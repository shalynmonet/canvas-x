import { useEffect, useState } from "react";
import { formatCountdown, lifetimeOfferMsLeft } from "@/lib/canvas";

/** Live countdown to the $1 lifetime offer deadline (11:59pm Central, Sept 14 2026). */
export function useOfferCountdown() {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    setMsLeft(lifetimeOfferMsLeft());
    const id = setInterval(() => setMsLeft(lifetimeOfferMsLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return { msLeft, live: msLeft !== null && msLeft > 0 };
}

export function OfferCountdown({ className = "" }: { className?: string }) {
  const { msLeft, live } = useOfferCountdown();
  if (msLeft === null) return null;

  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${className}`}>
      {live ? (
        <>
          <span className="text-accent">${LIFETIME_PRICE_USD} lifetime ends in</span>{" "}
          <span className="font-mono tabular-nums text-foreground">{formatCountdown(msLeft)}</span>
        </>
      ) : (
        <span className="text-muted-foreground">
          ${LIFETIME_PRICE_USD} lifetime offer has ended
        </span>
      )}
    </p>
  );
}
