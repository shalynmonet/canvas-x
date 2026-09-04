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
  platforms: string;
  start_date: string;
  source: string;
  main_poc: string;
  warmup_days: number;
  daily_engagement_minutes: number;
  base_pay: number;
  cpm_rate: number;
  min_daily_posts: number;
  pay_frequency: string;
  view_window_days: number;
  min_views_for_payout: number;
  same_cpm_for_all_platforms: boolean;
  has_per_post_bonus: boolean;
  per_post_bonus_amount: number;
  per_post_bonus_view_threshold: number;
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

export interface ViewEntry {
  id: string;
  collab_id: string;
  post_date: string;
  post_index: number;
  view_window_days: number;
  target_date: string;
  views: number | null;
  platform_views: Record<string, number | null>;
  logged_at: string;
}

export interface PlatformRate {
  id: string;
  collab_id: string;
  platform: string;
  cpm_rate: number;
}

export interface TodoItem {
  id: string;
  user_id: string;
  title: string;
  deadline: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
] as const;

export function platformLabel(value: string): string {
  return PLATFORM_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Platforms selected on the collab (stored comma-separated). */
export function collabPlatforms(collab: Collab): string[] {
  if (!collab.platforms) return [];
  return collab.platforms
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/** CPM that applies to a platform: the collab-wide rate, or the platform's own rate. */
export function cpmForPlatform(
  collab: Collab,
  rates: PlatformRate[],
  platform: string,
): number {
  if (collab.same_cpm_for_all_platforms !== false) return Number(collab.cpm_rate);
  const row = rates.find((r) => r.platform === platform);
  return Number(row?.cpm_rate ?? 0);
}

export const PAY_FREQUENCIES: PayFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "on completion",
];

export const MONTHLY_PRICE_USD = 9;
/** Yearly subscription price. */
export const YEARLY_PRICE_USD = 44;
/** Launch-offer lifetime price. */
export const LIFETIME_PRICE_USD = 44;

/**
 * Lifetime offer runs for 14 days from launch — ends 11:59pm Central
 * on September 14, 2026 (CDT, UTC-5).
 */
export const LIFETIME_OFFER_ENDS_AT = "2026-09-15T04:59:00Z";

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

/**
 * Estimated earnings for a single post once its views are entered.
 * A post only qualifies for CPM pay once it reaches minViews.
 */
export function postEstimatedEarnings(
  views: number,
  cpmRate: number,
  minViews: number = 0,
): number {
  if (views < minViews) return 0;
  return (views / 1000) * cpmRate;
}

/** CPM earnings for one logged post (no bonus), summed across every platform with views entered. */
export function entryCpmEarnings(
  entry: ViewEntry,
  collab: Collab,
  rates: PlatformRate[] = [],
): number {
  const min = Number(collab.min_views_for_payout ?? 0);
  const perPlatform = entry.platform_views ?? {};
  let sum = 0;
  let anyPlatformViews = false;
  for (const [platform, views] of Object.entries(perPlatform)) {
    if (views === null || views === undefined) continue;
    anyPlatformViews = true;
    sum += postEstimatedEarnings(views, cpmForPlatform(collab, rates, platform), min);
  }
  // Legacy single-total entries logged before per-platform tracking
  if (!anyPlatformViews && entry.views !== null) {
    sum += postEstimatedEarnings(entry.views, Number(collab.cpm_rate), min);
  }
  return sum;
}

/**
 * Whether this post earns the per-post bonus: the brand offers one, views are
 * entered, and the post's total views across platforms meet the threshold.
 */
export function entryBonusApplied(entry: ViewEntry, collab: Collab): boolean {
  if (!collab.has_per_post_bonus || !entryHasViews(entry)) return false;
  return entryTotalViews(entry) >= Number(collab.per_post_bonus_view_threshold);
}

/** Estimated earnings for one logged post: per-platform CPM plus the per-post bonus when earned. */
export function entryEstimatedEarnings(
  entry: ViewEntry,
  collab: Collab,
  rates: PlatformRate[] = [],
): number {
  const cpm = entryCpmEarnings(entry, collab, rates);
  return cpm + (entryBonusApplied(entry, collab) ? Number(collab.per_post_bonus_amount) : 0);
}

/** Total views logged on an entry across all platforms (legacy total as fallback). */
export function entryTotalViews(entry: ViewEntry): number {
  const perPlatform = entry.platform_views ?? {};
  const sum = Object.values(perPlatform).reduce<number>((s, v) => s + (v ?? 0), 0);
  if (sum > 0) return sum;
  return entry.views ?? 0;
}

/** Whether any view count (per-platform or legacy) has been entered for this post. */
export function entryHasViews(entry: ViewEntry): boolean {
  const perPlatform = entry.platform_views ?? {};
  return (
    entry.views !== null ||
    Object.values(perPlatform).some((v) => v !== null && v !== undefined)
  );
}

/** Collab-level estimate: base pay + per-post, per-platform CPM logged so far. */
export function estimatedEarnings(
  collab: Collab,
  entries: ViewEntry[],
  rates: PlatformRate[] = [],
): number {
  const viewsPay = entries.reduce(
    (sum, e) => sum + entryEstimatedEarnings(e, collab, rates),
    0,
  );
  return Number(collab.base_pay) + viewsPay;
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

