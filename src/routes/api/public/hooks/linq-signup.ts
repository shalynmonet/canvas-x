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
        const secret = expectedSecret();
        const sigHeader = request.headers.get("x-linq-signature");
        const secretHeader = request.headers.get("x-webhook-secret");
        const authHeader = request.headers.get("authorization");
        const provided =
          sigHeader ?? secretHeader ?? (authHeader ?? "").replace(/^Bearer\s+/i, "");

        // Diagnostic: never log full secret values, only shape + fingerprint.
        const mask = (v: string | null | undefined) =>
          !v ? null : { len: v.length, head: v.slice(0, 4), tail: v.slice(-4) };
        console.log(
          "[linq-signup] inbound auth debug",
          JSON.stringify({
            allHeaderNames: [...request.headers.keys()],
            headers: {
              "x-linq-signature": mask(sigHeader),
              "x-webhook-secret": mask(secretHeader),
              authorization: mask(authHeader),
            },
            providedSource: sigHeader
              ? "x-linq-signature"
              : secretHeader
                ? "x-webhook-secret"
                : authHeader
                  ? "authorization"
                  : "none",
            provided: mask(provided),
            expected: mask(secret),
            expectedFrom: process.env["LINQ_WEBHOOK_SECRET"]
              ? "LINQ_WEBHOOK_SECRET"
              : process.env["LINQ_API_KEY"]
                ? "LINQ_API_KEY"
                : "unset",
            match: Boolean(secret && provided && timingSafeEqual(provided, secret)),
          }),
        );

        if (!secret || !provided || !timingSafeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }


        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }

        const data = parsed.data;
        const event = data.event ?? data.type ?? null;
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
