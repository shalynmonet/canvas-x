import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Collab, DailyLog, PlatformRate, Profile, ViewEntry } from "@/lib/canvas";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useCollabs() {
  return useQuery({
    queryKey: ["collabs"],
    queryFn: async (): Promise<Collab[]> => {
      const { data, error } = await supabase
        .from("collabs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Collab[];
    },
  });
}

export function useCollab(id: string) {
  return useQuery({
    queryKey: ["collab", id],
    queryFn: async (): Promise<Collab | null> => {
      const { data, error } = await supabase
        .from("collabs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Collab | null;
    },
  });
}

export function useDailyLogs(date?: string) {
  return useQuery({
    queryKey: ["daily_logs", date ?? "all"],
    queryFn: async (): Promise<DailyLog[]> => {
      let query = supabase.from("daily_logs").select("*");
      if (date) query = query.eq("log_date", date);
      const { data, error } = await query.order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyLog[];
    },
  });
}

export function useDailyLogsRange(from: string, to: string) {
  return useQuery({
    queryKey: ["daily_logs", "range", from, to],
    queryFn: async (): Promise<DailyLog[]> => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyLog[];
    },
  });
}

export function useCollabLogs(collabId: string) {
  return useQuery({
    queryKey: ["collab_logs", collabId],
    queryFn: async (): Promise<DailyLog[]> => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("collab_id", collabId)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyLog[];
    },
  });
}

export function useViewEntries(collabId: string) {
  return useQuery({
    queryKey: ["view_entries", collabId],
    queryFn: async (): Promise<ViewEntry[]> => {
      const { data, error } = await supabase
        .from("view_entries")
        .select("*")
        .eq("collab_id", collabId)
        .order("post_date", { ascending: false })
        .order("post_index");
      if (error) throw error;
      return (data ?? []) as unknown as ViewEntry[];
    },
  });
}

export function usePlatformRates(collabId?: string) {
  return useQuery({
    queryKey: ["platform_rates", collabId ?? "none"],
    enabled: !!collabId,
    queryFn: async (): Promise<PlatformRate[]> => {
      const { data, error } = await supabase
        .from("platform_rates")
        .select("*")
        .eq("collab_id", collabId!);
      if (error) throw error;
      return (data ?? []) as unknown as PlatformRate[];
    },
  });
}
