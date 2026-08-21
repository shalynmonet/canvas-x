import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { useTodoItems } from "@/hooks/use-canvas";
import { supabase } from "@/integrations/supabase/client";
import { parseISODate, type TodoItem } from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/todo")({
  head: () => ({
    meta: [
      { title: "To Do — CanvOps" },
      {
        name: "description",
        content: "Your personal task list — track deadlines and check tasks off as you go.",
      },
      { property: "og:title", content: "To Do — CanvOps" },
      {
        property: "og:description",
        content: "Your personal task list — track deadlines and check tasks off as you go.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <AccessGate>
        <TodoScreen />
      </AccessGate>
    </AppShell>
  ),
});

function formatDeadline(iso: string): string {
  return `Due ${parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function TodoScreen() {
  const { data: items = [], isLoading } = useTodoItems();
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const pending = useMemo(() => {
    const open = items.filter((t) => !t.completed);
    const withDeadline = open
      .filter((t) => t.deadline)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
    const noDeadline = open.filter((t) => !t.deadline);
    return [...withDeadline, ...noDeadline];
  }, [items]);

  const completed = useMemo(
    () =>
      items
        .filter((t) => t.completed)
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [items],
  );

  async function toggleItem(item: TodoItem, next: boolean) {
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

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Task title is required.");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("todo_items").insert({
      user_id: auth.user.id,
      title: trimmed,
      deadline: deadline || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setDeadline("");
    setAdding(false);
    void queryClient.invalidateQueries({ queryKey: ["todo_items"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Tasks</p>
          <h1 className="mt-1 text-3xl font-bold">To Do</h1>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Add task
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={addItem} className="card-surface space-y-3 p-4">
          <div>
            <label htmlFor="todo-title" className="text-xs font-semibold text-muted-foreground">
              Task <span className="text-destructive">*</span>
            </label>
            <input
              id="todo-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Send draft to Acme for approval"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="todo-deadline" className="text-xs font-semibold text-muted-foreground">
              Deadline (optional)
            </label>
            <input
              id="todo-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save task"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setTitle("");
                setDeadline("");
              }}
              className="inline-flex h-11 items-center gap-1 rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="size-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}

      {!isLoading && pending.length === 0 && !adding && (
        <div className="card-surface p-6 text-center">
          <p className="text-lg font-semibold">All caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No open tasks. Add one whenever something comes up.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {pending.map((item) => (
          <TaskRow key={item.id} item={item} onToggle={toggleItem} />
        ))}
      </div>

      {completed.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {showCompleted ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            {showCompleted ? "Hide completed" : "Show completed"} ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-2">
              {completed.map((item) => (
                <TaskRow key={item.id} item={item} onToggle={toggleItem} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TaskRow({
  item,
  onToggle,
}: {
  item: TodoItem;
  onToggle: (item: TodoItem, next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item, !item.completed)}
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
      {item.deadline && (
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
          {formatDeadline(item.deadline)}
        </span>
      )}
    </button>
  );
}
