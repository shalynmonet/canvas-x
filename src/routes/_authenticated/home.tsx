import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { useCollabs, useDailyLogs, useTodoItems } from "@/hooks/use-canvas";
import { supabase } from "@/integrations/supabase/client";
import {
  collabDayState,
  currentWeek,
  isInWarmup,
  parseISODate,
  toISODate,
  type Collab,
  type DailyLog,
  type TodoItem,
} from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Today's checklist — CanvOps" },
      {
        name: "description",
        content: "Check off warmups, engagement time and posts for every active brand collab.",
      },
      { property: "og:title", content: "Today's checklist — CanvOps" },
      {
        property: "og:description",
        content: "Your daily collab checklist across every active brand deal.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <AccessGate>
        <HomeScreen />
      </AccessGate>
    </AppShell>
  ),
});

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function HomeScreen() {
  const today = toISODate(new Date());
  const [selected, setSelected] = useState(today);
  const week = useMemo(() => currentWeek(), []);
  const { data: collabs = [], isLoading } = useCollabs();
  const { data: logs = [] } = useDailyLogs(selected);
  const { data: todos = [] } = useTodoItems();
  const queryClient = useQueryClient();

  const active = collabs.filter((c) => c.status === "active");
  const logByCollab = new Map(logs.map((l) => [l.collab_id, l]));

  const dueTodos = useMemo(
    () =>
      todos
        .filter((t) => t.deadline === selected)
        .sort((a, b) => Number(a.completed) - Number(b.completed)),
    [todos, selected],
  );

  async function toggleTodo(item: TodoItem, next: boolean) {
    const { error } = await supabase
      .from("todo_items")
      .update({
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["todo_items"] });
  }

  async function upsertLog(collab: Collab, patch: Partial<DailyLog>) {
    const existing = logByCollab.get(collab.id);
    const { error } = await supabase.from("daily_logs").upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        collab_id: collab.id,
        log_date: selected,
        warmed_up: existing?.warmed_up ?? false,
        engaged: existing?.engaged ?? false,
        posted_count: existing?.posted_count ?? 0,
        ...patch,
      },
      { onConflict: "collab_id,log_date" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["daily_logs"] });
  }

  /** Mirror post check-offs into per-post view_entries rows. */
  async function syncViewEntry(collab: Collab, postIndex: number, checked: boolean) {
    if (checked) {
      const { error } = await supabase.from("view_entries").upsert(
        {
          collab_id: collab.id,
          post_date: selected,
          post_index: postIndex,
          view_window_days: collab.view_window_days,
        },
        { onConflict: "collab_id,post_date,post_index", ignoreDuplicates: true },
      );
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      // Only remove entries whose views haven't been entered yet.
      const { error } = await supabase
        .from("view_entries")
        .delete()
        .eq("collab_id", collab.id)
        .eq("post_date", selected)
        .eq("post_index", postIndex)
        .is("views", null);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    void queryClient.invalidateQueries({ queryKey: ["view_entries", collab.id] });
  }

  const longDate = new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {selected === today ? "Today" : "Past day"}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{longDate}</h1>
      </div>

      <div className="flex gap-1.5">
        {week.map((day) => {
          const iso = toISODate(day);
          const future = iso > today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              disabled={future}
              onClick={() => setSelected(iso)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : future
                    ? "border-border text-muted-foreground/40"
                    : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-[10px] uppercase opacity-70">
                {WEEKDAYS[day.getDay()]}
              </span>
              <span className="font-semibold">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading collabs…</p>}

      {!isLoading && active.length === 0 && (
        <div className="card-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">No active collabs yet.</p>
          <Link
            to="/collabs/new"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Add your first collab
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {active.map((collab) => {
          const log = logByCollab.get(collab.id);
          const state = collabDayState(collab, log, selected);
          const warmup = isInWarmup(collab, selected);
          const readOnly = selected !== today;
          const accentClass =
            state === "complete"
              ? "border-l-success"
              : state === "partial"
                ? "border-l-warning"
                : "border-l-destructive";

          return (
            <section key={collab.id} className={`card-surface border-l-4 p-4 ${accentClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{collab.brand_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {warmup ? `Warmup — ${collab.warmup_days} days` : "Warmed up"} ·{" "}
                    {collab.social_accounts || "no accounts set"}
                  </p>
                </div>
                <Link
                  to="/collabs/$id"
                  params={{ id: collab.id }}
                  aria-label={`${collab.brand_name} collab details`}
                  className="flex items-center gap-0.5 text-xs font-medium text-accent"
                >
                  Details <ChevronRight className="size-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {warmup ? (
                  <CheckRow
                    label="Warmed up today"
                    checked={log?.warmed_up ?? false}
                    disabled={readOnly}
                    onToggle={(next) => upsertLog(collab, { warmed_up: next })}
                  />
                ) : (
                  <>
                    <CheckRow
                      label={`Engaged today (${collab.daily_engagement_minutes} min)`}
                      checked={log?.engaged ?? false}
                      disabled={readOnly}
                      onToggle={(next) => upsertLog(collab, { engaged: next })}
                    />
                    {Array.from({ length: collab.min_daily_posts }, (_, i) => (
                      <CheckRow
                        key={i}
                        label={`Post ${i + 1} of ${collab.min_daily_posts}`}
                        checked={(log?.posted_count ?? 0) > i}
                        disabled={readOnly}
                        onToggle={(next) => {
                          void upsertLog(collab, {
                            posted_count: next ? i + 1 : i,
                          });
                          void syncViewEntry(collab, i + 1, next);
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {dueTodos.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {selected === today
                ? "To-do's due today"
                : `To-do's due ${parseISODate(selected).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}`}
            </h2>
            <Link
              to="/todo"
              className="flex items-center gap-0.5 text-xs font-medium text-accent"
            >
              All tasks <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {dueTodos.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleTodo(item, !item.completed)}
              className={`card-surface flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-medium transition-colors ${
                item.completed ? "opacity-60" : "hover:bg-secondary"
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-lg border ${
                  item.completed
                    ? "border-success bg-success text-success-foreground"
                    : "border-input"
                }`}
              >
                {item.completed && <Check className="size-4" />}
              </span>
              <span className={item.completed ? "line-through" : ""}>{item.title}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
        checked
          ? "border-success/40 bg-success/10 text-foreground"
          : "border-border bg-background hover:bg-secondary"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-lg border ${
          checked ? "border-success bg-success text-success-foreground" : "border-input"
        }`}
      >
        {checked && <Check className="size-4" />}
      </span>
      {label}
    </button>
  );
}
