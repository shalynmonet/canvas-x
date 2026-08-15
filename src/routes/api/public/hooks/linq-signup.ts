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
  phone: z.string().min(5).max(32).optional(),
  from: z.string().min(5).max(32).optional(),
  name: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
  text: z.string().max(2000).optional(),
  body: z.string().max(2000).optional(),
});

const SIGNUP_WORDS = ["start", "signup", "sign up", "join", "canvasx", "trial", "yes"];

function expectedSecret(): string | null {
  return process.env["LINQ_WEBHOOK_SECRET"] ?? process.env["LINQ_API_KEY"] ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendLinqMessage(phone: string, message: string) {
  const key = process.env["LINQ_API_KEY"];
  if (!key) return false;
  try {
    const res = await fetch("https://api.linq.app/v1/messages", {
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
        const provided =
          request.headers.get("x-linq-signature") ??
          request.headers.get("x-webhook-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

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

        await supabase.from("signup_leads").insert({
          phone,
          name: data.name ?? null,
          source: "linq",
          message: message || null,
          payload: raw as Record<string, unknown>,
          status: isSignup ? "invited" : "new",
        });

        let replied = false;
        if (isSignup && phone) {
          replied = await sendLinqMessage(
            phone,
            `Welcome to CanvasX! Start your 7-day trial here: ${signupUrl}`,
          );
        }

        return Response.json({ ok: true, lead: true, signup_intent: isSignup, replied });
      },
    },
  },
});
