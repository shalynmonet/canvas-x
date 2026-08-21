import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { confirmCheckout } from "@/lib/billing.functions";

export const Route = createFileRoute("/billing/return")({
  ssr: false,
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Confirming your subscription — CanvOps" },
      {
        name: "description",
        content: "CanvOps is confirming your payment with Stripe and unlocking full access.",
      },
      { property: "og:title", content: "Confirming your subscription — CanvOps" },
      { property: "og:description", content: "Unlocking full CanvOps access automatically." },
    ],
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const confirm = useServerFn(confirmCheckout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Confirming your payment with Stripe…");

  useEffect(() => {
    if (!sessionId) {
      setMessage("No checkout session found.");
      return;
    }
    let cancelled = false;
    confirm({ data: { sessionId } })
      .then(async (result) => {
        if (cancelled) return;
        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        if (result.unlocked) {
          setMessage("Payment confirmed — unlocking CanvOps…");
          navigate({ to: "/home", replace: true });
        } else {
          setMessage("Stripe hasn't confirmed this payment yet. Try again in a moment.");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Could not confirm payment");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-sm px-5 py-24 text-center">
      <h1 className="text-2xl font-bold">CanvOps Pro</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
