import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { useCollabs, useDailyLogsRange } from "@/hooks/use-canvas";
import {
  collabDayState,
  isInWarmup,
  toISODate,
  type Collab,
  type DailyLog,
} from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — CanvOps" },
      {
        name: "description",
        content: "A monthly calendar of your collab logs — pick any day to review warmups, engagement and posts.",
      },
      { property: "og:title", content: "Calendar — CanvOps" },
      {
        property: "og:description",
        content: "Review your daily collab checklist history on a monthly calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <AccessGate>
        <CalendarScreen />
      </AccessGate>
    </AppShell>
  ),
});

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function CalendarScreen() {
  const today = toISODate(new Date());
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(today);

  const { data: collabs = [], isLoading } = useCollabs();

  const cells = useMemo(() => monthCells(month.year, month.month), [month]);
  const rangeFrom = toISODate(cells[0]!);
  const rangeTo = toISODate(cells[cells.length - 1]!);
  const { data: logs = [] } = useDailyLogsRange(rangeFrom, rangeTo);

  const logsByDate = useMemo(() => {
    const map = new Map<string, DailyLog[]>();
    for (const log of logs) {
      const list = map.get(log.log_date) ?? [];
      list.push(log);
      map.set(log.log_date, list);
    }
    return map;
  }, [logs]);

  function shiftMonth(delta: number) {
    setMonth((m) => {
      const d = new Date(m.year, m.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth = month.year === now.getFullYear() && month.month === now.getMonth();

  /** Collabs that existed on a given date (started on or before it). */
  const collabsOn = (date: string) => collabs.filter((c) => c.start_date <= date);

  /** Aggregate dot color for a day cell. */
  function dayTone(date: string): "success" | "warning" | "muted" | null {
    const dayLogs = logsByDate.get(date);
    if (!dayLogs || dayLogs.length === 0) return null;
    const logMap = new Map(dayLogs.map((l) => [l.collab_id, l]));
    const tracked = collabsOn(date).filter((c) => logMap.has(c.id));
    if (tracked.length === 0) return "muted";
    const states = tracked.map((c) => collabDayState(c, logMap.get(c.id), date));
    if (states.every((s) => s === "complete")) return "success";
    if (states.some((s) => s === "complete" || s === "partial")) return "warning";
    return "muted";
  }

  const selectedLogs = logsByDate.get(selected) ?? [];
  const selectedLogByCollab = new Map(selectedLogs.map((l) => [l.collab_id, l]));
  const selectedCollabs = collabsOn(selected);
  const selectedLong = new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">History</p>
          <h1 className="mt-1 text-3xl font-bold">{monthLabel}</h1>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => {
                setMonth({ year: now.getFullYear(), month: now.getMonth() });
                setSelected(today);
              }}
              className="mr-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
            >
              Today
            </button>
          )}
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <section className="card-surface p-3" aria-label={`${monthLabel} calendar`}>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <span
              key={i}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((day) => {
            const iso = toISODate(day);
            const inMonth = day.getMonth() === month.month;
            const isSelected = iso === selected;
            const tone = dayTone(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-label={`View logs for ${new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                aria-pressed={isSelected}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : inMonth
                      ? "border-transparent bg-background hover:bg-secondary"
                      : "border-transparent text-muted-foreground/40 hover:bg-secondary"
                } ${iso === today && !isSelected ? "font-bold text-accent" : ""}`}
              >
                <span>{day.getDate()}</span>
                <span
                  className={`size-1.5 rounded-full ${
                    tone === "success"
                      ? "bg-success"
                      : tone === "warning"
                        ? "bg-warning"
                        : tone === "muted"
                          ? "bg-muted-foreground/50"
                          : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {selected === today ? "Today — " : ""}
          {selectedLong}
        </h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && selectedCollabs.length === 0 && (
          <div className="card-surface p-6 text-center">
            <p className="text-sm text-muted-foreground">No collabs had started by this day.</p>
            <Link
              to="/collabs/new"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Add a collab
            </Link>
          </div>
        )}

        {selectedCollabs.map((collab) => (
          <DayOverviewCard
            key={collab.id}
            collab={collab}
            log={selectedLogByCollab.get(collab.id)}
            date={selected}
          />
        ))}
      </section>
    </div>
  );
}

function DayOverviewCard({
  collab,
  log,
  date,
}: {
  collab: Collab;
  log: DailyLog | undefined;
  date: string;
}) {
  const warmup = isInWarmup(collab, date);
  const state = collabDayState(collab, log, date);
  const accentClass =
    state === "complete"
      ? "border-l-success"
      : state === "partial"
        ? "border-l-warning"
        : "border-l-destructive";

  return (
    <article className={`card-surface border-l-4 p-4 ${accentClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{collab.brand_name}</h3>
          <p className="text-xs text-muted-foreground">
            {warmup ? `Warmup — ${collab.warmup_days} days` : "Warmed up"}
            {collab.social_accounts ? ` · ${collab.social_accounts}` : ""}
          </p>
        </div>
        <Link
          to="/collabs/$id"
          params={{ id: collab.id }}
          aria-label={`${collab.brand_name} collab details`}
          className="flex items-center gap-0.5 text-xs font-medium text-accent"
        >
          Details <Arrow className="size-3.5" />
        </Link>
      </div>

      {log ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <MiniStat
            label={warmup ? "Warmed up" : "Engaged"}
            value={
              (warmup ? log.warmed_up : log.engaged)
                ? "Yes"
                : "No"
            }
          />
          {!warmup && (
            <MiniStat label="Posts" value={`${log.posted_count} / ${collab.min_daily_posts}`} />
          )}
          <MiniStat
            label="Status"
            value={state === "complete" ? "Done" : state === "partial" ? "Partial" : "Missed"}
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No checklist activity logged this day.</p>
      )}

      {log?.notes && (
        <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
          {log.notes}
        </p>
      )}
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-display text-sm font-bold">{value}</dd>
    </div>
  );
}
