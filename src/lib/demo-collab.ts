import type { Collab } from "@/lib/canvas";

const STORAGE_KEY = "canvops.demo.collab";

/** The collab fields captured by the form, before it ever touches the database. */
export type DemoCollabFields = Omit<Collab, "id" | "user_id" | "created_at">;

export interface DemoCollabDraft {
  fields: DemoCollabFields;
  platformRates: Record<string, number>;
  savedAt: string;
}

export function saveDemoCollab(
  fields: DemoCollabFields,
  platformRates: Record<string, number>,
): DemoCollabDraft {
  const draft: DemoCollabDraft = {
    fields,
    platformRates,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }
  return draft;
}

export function readDemoCollab(): DemoCollabDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoCollabDraft;
    if (!parsed?.fields?.brand_name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDemoCollab() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

/** A stand-in Collab object so preview UI can reuse the real calculations. */
export function draftToCollab(draft: DemoCollabDraft): Collab {
  return {
    ...draft.fields,
    id: "demo",
    user_id: "demo",
    created_at: draft.savedAt,
  };
}
