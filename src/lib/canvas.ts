export type PayFrequency = "weekly" | "biweekly" | "monthly" | "on completion";

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  reminder_time: string | null;
  reminder_enabled: boolean;
  timezone: string | null;
  trial_ends_at: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface Collab {
  id: string;
  user_id: string;
  brand_name: string;
  social_accounts: string;
  start_date: string;
  source: string;
  main_poc: string;
  warmup_days: number;
  daily_engagement_minutes: number;
  base_pay: number;
  cpm_rate: number;
  min_daily_posts: number;
  pay_frequency: string;
  status: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  collab_id: string;
  log_date: string;
  warmed_up: boolean;
  engaged: boolean;
  posted_count: number;
  notes: string | null;
}

export interface ViewLog {
  id: string;
  collab_id: string;
  day_number: number;
  view_count: number;
}

export interface CalibrationRow {
  collab_type: string;
  avg_warmup_days: number | null;
  avg_engagement_minutes: number | null;
  avg_min_posts: number | null;
  response_count: number;
}

export const COLLAB_TYPES = [
  "new fashion brand",
  "established beauty brand",
  "app/software brand",
  "agency",
] as const;

export const PAY_FREQUENCIES: PayFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "on completion",
];

export const MONTHLY_PRICE_USD = 9;
export const YEARLY_PRICE_USD = 14;
export const LIFETIME_PRICE_USD = 1;

/** Launch-day lifetime offer deadline: 3:45pm Chicago (CDT, UTC-5). */
export const LIFETIME_OFFER_ENDS_AT = "2026-08-15T20:45:00Z";

export function lifetimeOfferMsLeft(now: number = Date.now()): number {
  return Math.max(0, new Date(LIFETIME_OFFER_ENDS_AT).getTime() - now);
}

export function isLifetimeOfferLive(now: number = Date.now()): boolean {
  return lifetimeOfferMsLeft(now) > 0;
}

export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Local (not UTC) YYYY-MM-DD */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function currentWeek(today = new Date()): Date[] {
  const start = addDays(today, -today.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function warmupEndDate(startDate: string, warmupDays: number): string {
  return toISODate(addDays(parseISODate(startDate), warmupDays));
}

export function isInWarmup(collab: Collab, date: string): boolean {
  return date < warmupEndDate(collab.start_date, collab.warmup_days);
}

export function dayNumber(startDate: string, date: string): number {
  const diff =
    (parseISODate(date).getTime() - parseISODate(startDate).getTime()) / 86_400_000;
  return Math.floor(diff) + 1;
}

export function estimatedEarnings(collab: Collab, views: ViewLog[]): number {
  const totalViews = views.reduce((sum, v) => sum + (v.view_count || 0), 0);
  return Number(collab.base_pay) + (totalViews / 1000) * Number(collab.cpm_rate);
}

export type CollabDayState = "complete" | "partial" | "empty";

export function collabDayState(
  collab: Collab,
  log: DailyLog | undefined,
  date: string,
): CollabDayState {
  if (isInWarmup(collab, date)) {
    return log?.warmed_up ? "complete" : "empty";
  }
  const posts = log?.posted_count ?? 0;
  const engaged = log?.engaged ?? false;
  if (engaged && posts >= collab.min_daily_posts) return "complete";
  if (engaged || posts > 0) return "partial";
  return "empty";
}

export function hasAccess(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status === "active") return true;
  if (profile.subscription_status === "lifetime") return true;
  return (
    profile.subscription_status === "trialing" &&
    new Date(profile.trial_ends_at).getTime() > Date.now()
  );
}

export function trialDaysLeft(profile: Profile): number {
  const ms = new Date(profile.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Maps a free-text collab source onto a calibrated collab_type bucket. */
export function matchCollabType(source: string): string | null {
  const s = source.toLowerCase();
  if (!s.trim()) return null;
  if (/(fashion|apparel|clothing|streetwear)/.test(s)) return "new fashion brand";
  if (/(beauty|skincare|cosmetic|makeup)/.test(s)) return "established beauty brand";
  if (/(app|software|saas|tech|game)/.test(s)) return "app/software brand";
  if (/(agency|manager|management)/.test(s)) return "agency";
  return null;
}

/** Single bucket used now that the survey no longer classifies brand type. */
export const GENERAL_COLLAB_TYPE = "all collabs";

export interface CalibrationSummary {
  responseCount: number;
  warmupDays: number | null;
  engagementMinutes: number | null;
  minPosts: number | null;
}

/** Response-weighted average across every calibration bucket. */
export function summarizeCalibration(rows: CalibrationRow[]): CalibrationSummary {
  const total = rows.reduce((sum, r) => sum + r.response_count, 0);
  if (total === 0) {
    return { responseCount: 0, warmupDays: null, engagementMinutes: null, minPosts: null };
  }
  const weighted = (pick: (r: CalibrationRow) => number | null) => {
    let num = 0;
    let den = 0;
    for (const r of rows) {
      const v = pick(r);
      if (v === null || v === undefined || r.response_count === 0) continue;
      num += Number(v) * r.response_count;
      den += r.response_count;
    }
    return den === 0 ? null : num / den;
  };
  return {
    responseCount: total,
    warmupDays: weighted((r) => r.avg_warmup_days),
    engagementMinutes: weighted((r) => r.avg_engagement_minutes),
    minPosts: weighted((r) => r.avg_min_posts),
  };
}
