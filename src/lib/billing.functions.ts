import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LIFETIME_OFFER_ENDS_AT } from "@/lib/canvas";

const stripeForm = (params: Record<string, string>) =>
  new URLSearchParams(params).toString();

async function stripe(path: string, body?: Record<string, string>) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: stripeForm(body) } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (json["error"] as { message?: string } | undefined)?.message ?? "Stripe error";
    console.error("Stripe error", path, message);
    throw new Error(message);
  }
  return json;
}

const PRICE_IDS = {
  monthly: "price_1UBPrpI6kyrZOaksHsml1ztp",
  yearly: "price_1UBPrJI6kyrZOaksu61wwtSf",
  lifetime: "price_1UBPsEI6kyrZOakswY4YHkN3",
} as const;

/** Creates a Stripe Checkout session: $9/mo, $44/yr, or $44 lifetime while the launch offer runs. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: z.string().url(),
        plan: z.enum(["monthly", "yearly", "lifetime"]).default("yearly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = (profile as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe("customers", {
        email: String((claims as { email?: string }).email ?? ""),
        "metadata[user_id]": userId,
      });
      customerId = String(customer["id"]);
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const lifetime = data.plan === "lifetime";
    if (lifetime && Date.now() >= new Date(LIFETIME_OFFER_ENDS_AT).getTime()) {
      throw new Error("The lifetime offer has expired");
    }

    const base: Record<string, string> = {
      customer: customerId,
      "line_items[0][quantity]": "1",
      "line_items[0][price]": PRICE_IDS[data.plan],
      client_reference_id: userId,
      success_url: `${data.origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/upgrade`,
      "metadata[plan]": data.plan,
    };

    const session = await stripe(
      "checkout/sessions",
      lifetime
        ? {
            ...base,
            mode: "payment",
            "payment_intent_data[metadata][user_id]": userId,
          }
        : {
            ...base,
            mode: "subscription",
            "subscription_data[metadata][user_id]": userId,
          },
    );

    return { url: String(session["url"]) };
  });


/**
 * Payments Agent: confirms payment directly with Stripe and unlocks access.
 * No human approval step — Stripe's answer is the only gate.
 */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().min(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const session = await stripe(`checkout/sessions/${encodeURIComponent(data.sessionId)}`);
    if (session["client_reference_id"] !== userId) {
      throw new Error("This checkout session does not belong to you");
    }
    const paid = session["payment_status"] === "paid" || session["status"] === "complete";
    if (!paid) return { unlocked: false, status: String(session["status"] ?? "open") };

    const isLifetime = session["mode"] === "payment";
    const status = isLifetime ? "lifetime" : "active";

    await supabase
      .from("profiles")
      .update({
        subscription_status: status,
        stripe_subscription_id: session["subscription"] ? String(session["subscription"]) : null,
        stripe_customer_id: session["customer"] ? String(session["customer"]) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return { unlocked: true, status };
  });


/** Re-reads the live subscription from Stripe and syncs subscription_status. */
export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", userId)
      .maybeSingle();
    const row = profile as
      | { stripe_subscription_id?: string | null; subscription_status?: string | null }
      | null;
    if (row?.subscription_status === "lifetime") return { status: "lifetime" };
    const subId = row?.stripe_subscription_id;
    if (!subId) return { status: null };

    const sub = await stripe(`subscriptions/${encodeURIComponent(subId)}`);
    const stripeStatus = String(sub["status"]);
    const status =
      stripeStatus === "active" || stripeStatus === "trialing"
        ? "active"
        : stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired"
          ? "canceled"
          : "active";
    await supabase
      .from("profiles")
      .update({ subscription_status: status, updated_at: new Date().toISOString() })
      .eq("id", userId);
    return { status };
  });
