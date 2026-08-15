import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isLifetimeOfferLive } from "@/lib/canvas";

/**
 * Signup Agent — inbound Linq webhook.
 *
 * Linq posts inbound iMessages here. When someone texts a signup intent
 * (e.g. "start", "signup", "join"), the agent records the lead and replies
 * with the signup link. Everything else is stored for follow-up.
 */

const payloadSchema = z.object({
  event: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  phone: z.string().min(5).max(32).optional(),
  from: z.string().min(5).max(32).optional(),
  name: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
  text: z.string().max(2000).optional(),
  body: z.string().max(2000).optional(),
  attachments: z.array(z.unknown()).max(20).optional(),
});

/** Linq webhook event we subscribe to: carries full inbound message + attachments. */
const INBOUND_EVENT = "message.received";

const SIGNUP_WORDS = ["start", "signup", "sign up", "join", "canvasx", "canvas", "trial", "yes"];


function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Linq signs webhooks with the Standard Webhooks scheme:
 *   webhook-id, webhook-timestamp, webhook-signature: "v1,<base64 HMAC-SHA256>"
 * signed over `${id}.${timestamp}.${rawBody}` using the endpoint signing secret
 * (LINQ_WEBHOOK_SECRET, usually prefixed `whsec_`) — NOT the Linq API key.
 */
async function verifyStandardWebhook(
  rawBody: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
): Promise<{ ok: boolean; reason?: string; computed?: string }> {
  const raw = process.env["LINQ_WEBHOOK_SECRET"];
  if (!raw) return { ok: false, reason: "LINQ_WEBHOOK_SECRET is not set" };

  const secretBytes = raw.startsWith("whsec_")
    ? Uint8Array.from(atob(raw.slice("whsec_".length)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(raw);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header may carry several space-separated versioned signatures.
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  if (candidates.length === 0) return { ok: false, reason: "no v1 signature in header", computed };

  const match = candidates.some((candidate) => timingSafeEqual(candidate, computed));
  return match ? { ok: true, computed } : { ok: false, reason: "signature mismatch", computed };
}


async function sendLinqMessage(phone: string, message: string) {
  const key = process.env["LINQ_API_KEY"];
  if (!key) return false;
  try {
    const res = await fetch("https://api.linqapp.com/v1/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, channel: "imessage", text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/linq-signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const id = request.headers.get("webhook-id") ?? "";
        const timestamp =
          request.headers.get("webhook-timestamp") ??
          request.headers.get("x-webhook-timestamp") ??
          "";
        const signature =
          request.headers.get("webhook-signature") ??
          request.headers.get("x-webhook-signature") ??
          "";

        const rawBody = await request.text();

        const verdict =
          id && timestamp && signature
            ? await verifyStandardWebhook(rawBody, id, timestamp, signature)
            : { ok: false, reason: "missing webhook-id / timestamp / signature headers" };

        // Diagnostic: fingerprints only, never full secret or signature values.
        const mask = (v: string | null | undefined) =>
          !v ? null : { len: v.length, head: v.slice(0, 6), tail: v.slice(-6) };
        console.log(
          "[linq-signup] signature check",
          JSON.stringify({
            event: request.headers.get("x-webhook-event"),
            hasId: Boolean(id),
            timestamp,
            providedSignature: mask(signature),
            computedSignature: mask(verdict.computed),
            secretConfigured: Boolean(process.env["LINQ_WEBHOOK_SECRET"]),
            ok: verdict.ok,
            reason: verdict.reason ?? null,
          }),
        );

        // TEMPORARY (hackathon only): Linq's webhook signing secret is unconfirmed,
        // so a failed/absent signature check does NOT reject the request. This leaves
        // the endpoint open to spoofed posts.
        // TODO: before any production use, set LINQ_WEBHOOK_SECRET and restore the
        // hard 401 below so unverified requests are rejected.
        const ENFORCE_SIGNATURE = false;
        if (!verdict.ok) {
          console.warn(
            "[linq-signup] SECURITY: proceeding with UNVERIFIED webhook —",
            verdict.reason,
            "— signature verification must be re-enabled (set LINQ_WEBHOOK_SECRET and flip ENFORCE_SIGNATURE) before production use beyond the hackathon.",
          );
          if (ENFORCE_SIGNATURE) {
            return new Response("Unauthorized", { status: 401 });
          }
        }


        let raw: unknown;
        try {
          raw = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }


        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }

        const data = parsed.data;
        const event =
          data.event ?? data.type ?? request.headers.get("x-webhook-event") ?? null;

        if (event && event !== INBOUND_EVENT) {
          return Response.json({ ok: true, ignored: true, event });
        }
        const phone = data.phone ?? data.from ?? null;
        const message = data.message ?? data.text ?? data.body ?? "";
        const isSignup = SIGNUP_WORDS.some((w) => message.toLowerCase().includes(w));

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
          { auth: { persistSession: false } },
        );

        const origin = new URL(request.url).origin;
        const signupUrl = `${origin}/auth`;
        const upgradeUrl = `${origin}/upgrade`;

        await supabase.from("signup_leads").insert({
          phone,
          name: data.name ?? null,
          source: "linq",
          message: message || null,
          payload: raw as Record<string, unknown>,
          status: isSignup ? "invited" : "new",
        });

        const isLifetimeIntent = message.toLowerCase().includes("canvas");
        const lifetimeLive = isLifetimeOfferLive();

        let replied = false;
        if (isSignup && phone) {
          if (isLifetimeIntent && lifetimeLive) {
            replied = await sendLinqMessage(
              phone,
              `CanvasX lifetime access — only $1 today! Claim it before 7:45pm Chicago time: ${upgradeUrl}`,
            );
          } else {
            replied = await sendLinqMessage(
              phone,
              `Welcome to CanvasX! Start your 7-day trial here: ${signupUrl}`,
            );
          }
        }

        return Response.json({ ok: true, lead: true, signup_intent: isSignup, replied });
      },
    },
  },
});
