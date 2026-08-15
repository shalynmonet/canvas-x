import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface CollabRow {
  id: string;
  user_id: string;
  brand_name: string;
  start_date: string;
  warmup_days: number;
  min_daily_posts: number;
}

interface LogRow {
  collab_id: string;
  warmed_up: boolean;
  engaged: boolean;
  posted_count: number;
}

interface ProfileRow {
  id: string;
  name: string;
  phone: string | null;
  reminder_time: string | null;
  reminder_enabled: boolean;
  timezone: string;
  subscription_status: string;
  trial_ends_at: string;
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function localTimeComponents(utc: Date, timeZone: string): { hours: number; minutes: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utc);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    hours: Number(get("hour")),
    minutes: Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

async function sendLinqMessage(phone: string, message: string) {
  const key = process.env["LINQ_API_KEY"];
  if (!key) return { ok: false, error: "Linq is not configured" };
  try {
    const res = await fetch("https://api.linqapp.com/v3/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: [phone], message: { parts: [{ type: "text", value: message }] } }),
    });

    if (!res.ok) {
      console.error("Linq send failed", res.status, await res.text().catch(() => ""));
      return { ok: false, error: `Linq responded ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("Linq send error", error);
    return { ok: false, error: "Could not reach Linq" };
  }
}

/**
 * Reminder Agent (Linq). Runs every 15 minutes via a scheduled job.
 * Texts creators only when an active collab is still incomplete for today.
 */
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !serviceKey) {
          return Response.json({ error: "Backend not configured" }, { status: 500 });
        }
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const allowedKeys = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter(Boolean);
        if (!apiKey || !allowedKeys.includes(apiKey)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }


        const db = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const now = new Date();
        const appUrl = "https://canvas-x.lovable.app";

        const { data: profiles, error } = await db
          .from("profiles")
          .select("id, name, phone, reminder_time, reminder_enabled, timezone, subscription_status, trial_ends_at")
          .eq("reminder_enabled", true)
          .not("phone", "is", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        let skipped = 0;

        for (const profile of (profiles ?? []) as ProfileRow[]) {
          if (!profile.reminder_time || !profile.phone) continue;

          const tz = profile.timezone || "UTC";
          const local = localTimeComponents(now, tz);
          const nowMinutes = local.hours * 60 + local.minutes;
          const today = local.date;
          const target = minutesOfDay(profile.reminder_time);
          if (Math.abs(nowMinutes - target) > 15) continue;

          const active =
            profile.subscription_status === "active" ||
            (profile.subscription_status === "trialing" &&
              new Date(profile.trial_ends_at).getTime() > now.getTime());
          if (!active) continue;

          const { data: collabs } = await db
            .from("collabs")
            .select("id, user_id, brand_name, start_date, warmup_days, min_daily_posts")
            .eq("user_id", profile.id)
            .eq("status", "active");
          const list = (collabs ?? []) as CollabRow[];
          if (list.length === 0) continue;

          const { data: alreadySent } = await db
            .from("reminder_logs")
            .select("id, sent_at")
            .eq("user_id", profile.id)
            .order("sent_at", { ascending: false })
            .limit(1);
          const sentToday = (alreadySent ?? []).some((log) => {
            const sentLocal = localTimeComponents(new Date(log.sent_at), tz);
            return sentLocal.date === today;
          });
          if (sentToday) {
            skipped += 1;
            continue;
          }

          const { data: logs } = await db
            .from("daily_logs")
            .select("collab_id, warmed_up, engaged, posted_count")
            .eq("log_date", today)
            .in(
              "collab_id",
              list.map((c) => c.id),
            );
          const byCollab = new Map(((logs ?? []) as LogRow[]).map((l) => [l.collab_id, l]));

          const incomplete: string[] = [];
          const flagged: string[] = [];
          for (const collab of list) {
            const log = byCollab.get(collab.id);
            const warmupEnd = new Date(collab.start_date);
            warmupEnd.setDate(warmupEnd.getDate() + collab.warmup_days);
            const inWarmup = today < warmupEnd.toISOString().slice(0, 10);
            if (inWarmup) {
              if (!log?.warmed_up) {
                incomplete.push(`${collab.brand_name} — warmup not logged`);
                flagged.push(collab.id);
              }
              continue;
            }
            const posts = log?.posted_count ?? 0;
            const missing = Math.max(0, collab.min_daily_posts - posts);
            if (!log?.engaged || missing > 0) {
              const parts: string[] = [];
              if (!log?.engaged) parts.push("engagement not checked");
              if (missing > 0) parts.push(`${missing} post${missing === 1 ? "" : "s"} still needed`);
              incomplete.push(`${collab.brand_name} — ${parts.join(", ")}`);
              flagged.push(collab.id);
            }
          }

          if (incomplete.length === 0) {
            skipped += 1;
            continue;
          }

          const message = `Canvas: You haven't logged ${incomplete.join("; ")} yet today. Tap to check off: ${appUrl}/home`;
          const result = await sendLinqMessage(profile.phone, message);
          await db.from("reminder_logs").insert({
            user_id: profile.id,
            collab_ids_flagged: flagged.join(","),
            message: result.ok ? message : `${message} [not delivered: ${result.error}]`,
          });
          if (result.ok) sent += 1;
        }

        return Response.json({ ok: true, sent, skipped, checked: (profiles ?? []).length });
      },
    },
  },
});
