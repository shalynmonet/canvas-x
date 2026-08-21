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

/** Creates a Stripe Checkout session: $14/yr subscription, or $1 lifetime while the offer runs. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: z.string().url(),
        plan: z.enum(["yearly", "lifetime"]).default("yearly"),
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
      throw new Error("The $1 lifetime offer has expired");
    }

    const base: Record<string, string> = {
      customer: customerId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      client_reference_id: userId,
      success_url: `${data.origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/upgrade`,
    };

    const session = await stripe(
      "checkout/sessions",
      lifetime
        ? {
            ...base,
            mode: "payment",
            "line_items[0][price_data][unit_amount]": "100",
            "line_items[0][price_data][product_data][name]": "CanvOps Lifetime Access",
            "payment_intent_data[metadata][user_id]": userId,
            "metadata[plan]": "lifetime",
          }
        : {
            ...base,
            mode: "subscription",
            "line_items[0][price_data][unit_amount]": "1400",
            "line_items[0][price_data][recurring][interval]": "year",
            "line_items[0][price_data][product_data][name]": "CanvOps Pro (yearly)",
            "subscription_data[trial_period_days]": "7",
            "subscription_data[metadata][user_id]": userId,
            "metadata[plan]": "yearly",
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
