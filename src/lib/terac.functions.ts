import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const responseSchema = z.object({
  answers: z
    .array(
      z.object({
        collab_type: z.string().trim().min(2).max(60),
        warmup_days: z.number().int().min(2).max(5),
        engagement_minutes: z.number().int().min(10).max(45),
        min_posts: z.number().int().min(0).max(10),
      }),
    )
    .min(1)
    .max(8),
  respondent_source: z.string().trim().max(40).optional(),
});

/** Public: stores one respondent's survey answers and recomputes calibrated averages. */
export const submitSurveyResponse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => responseSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.answers.map((a) => ({
      ...a,
      respondent_source: data.respondent_source ?? "terac",
    }));
    const { error } = await supabaseAdmin.from("calibration_responses").insert(rows);
    if (error) throw new Error(error.message);
    const { error: rpcError } = await supabaseAdmin.rpc("recompute_calibration");
    if (rpcError) throw new Error(rpcError.message);
    return { saved: rows.length };
  });

/**
 * Terac distribution: pushes the calibration survey to real creator respondents.
 * Returns a typed fallback when Terac is unreachable so the UI stays usable.
 */
export const distributeSurveyViaTerac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ surveyUrl: z.string().url(), sampleSize: z.number().int().min(5).max(500) }).parse(
      input,
    ),
  )
  .handler(async ({ data }) => {
    const key = process.env["TERAC_API_KEY"];
    if (!key) return { ok: false, error: "Terac is not configured" };
    try {
      const res = await fetch("https://api.terac.com/v1/surveys", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "CanvasX creator collab calibration",
          audience: { segment: "ugc_creators", size: data.sampleSize },
          survey_url: data.surveyUrl,
          questions: [
            "Ideal warmup length (days) per collab type",
            "Daily engagement time once warmed up (minutes)",
            "Sustainable minimum posts per day",
          ],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        console.error("Terac distribution failed", res.status, body);
        return { ok: false, error: `Terac responded ${res.status}` };
      }
      return { ok: true, id: body["id"] ? String(body["id"]) : null };
    } catch (error) {
      console.error("Terac distribution error", error);
      return { ok: false, error: "Could not reach Terac" };
    }
  });
