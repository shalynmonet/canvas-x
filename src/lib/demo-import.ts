import { supabase } from "@/integrations/supabase/client";
import { clearDemoCollab, readDemoCollab } from "@/lib/demo-collab";
import { collabPlatforms } from "@/lib/canvas";

/**
 * Turns a demo draft from local storage into the user's first real collab.
 * Returns the new collab id, or null when there was no demo to import.
 */
export async function importDemoCollab(): Promise<string | null> {
  const draft = readDemoCollab();
  if (!draft) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("collabs")
    .insert({ ...draft.fields, user_id: auth.user.id })
    .select("id")
    .single();
  if (error) throw error;
  const collabId = (data as { id: string }).id;

  if (!draft.fields.same_cpm_for_all_platforms) {
    const platforms = collabPlatforms({ ...draft.fields, id: collabId, user_id: auth.user.id, created_at: draft.savedAt });
    if (platforms.length > 0) {
      await supabase.from("platform_rates").insert(
        platforms.map((p) => ({
          collab_id: collabId,
          platform: p,
          cpm_rate: draft.platformRates[p] ?? 0,
        })),
      );
    }
  }

  clearDemoCollab();
  return collabId;
}
