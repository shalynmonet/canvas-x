import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to CanvOps — UGC collab organizer" },
      {
        name: "description",
        content:
          "Log in or create your CanvOps account to track brand deals, daily posting checklists and earnings estimates.",
      },
      { property: "og:title", content: "Sign in to CanvOps" },
      {
        property: "og:description",
        content: "Track every UGC brand deal, daily checklist and payout in one place.",
      },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number the reminders can reach")
    .max(20)
    .regex(/^[+0-9()\-.\s]+$/, "Digits, spaces and + only"),
  reminder_time: z.string().max(5),
});

function AuthPage() {
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const requestedPlan = new URL(href, "http://canvasx.local").searchParams.get("plan");
  const plan = requestedPlan === "lifetime" || requestedPlan === "yearly" ? requestedPlan : null;
  const isLifetime = plan === "lifetime";

  function afterAuth() {
    if (plan) {
      window.location.href = `/upgrade?plan=${plan}&start=1`;
      return;
    }
    navigate({ to: "/home" });
  }
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    reminder_time: "",
  });
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email.trim(),
          password: values.password,
        });
        if (error) throw error;
        afterAuth();
        return;
      }

      const parsed = signupSchema.safeParse(values);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Check your details");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: plan
            ? `${window.location.origin}/upgrade?plan=${plan}&start=1`
            : `${window.location.origin}/home`,
          data: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            reminder_time: parsed.data.reminder_time,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        toast.success(
          plan ? "Account created — opening checkout" : "Your 7-day free trial has started",
        );
        afterAuth();
      } else {
        setCheckEmail(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <main className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Confirm your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a confirmation link to {values.email}. Open it and {isLifetime
            ? "we’ll take you straight to the $1 lifetime checkout."
            : "your 7-day free trial starts right away."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <Logo to="/" />
      <h1 className="mt-6 text-3xl font-bold">
        {mode === "signup"
          ? isLifetime
            ? "Claim $1 lifetime access"
            : "Start your 7-day trial"
          : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signup"
          ? isLifetime
            ? "Create your account, then complete the one-time $1 checkout. No trial or renewal."
            : "Every brand deal, warmup window and post count in one daily checklist."
          : "Pick up today's checklist where you left off."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={values.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={values.email}
            maxLength={255}
            onChange={(e) => set("email", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={values.password}
            maxLength={72}
            onChange={(e) => set("password", e.target.value)}
            required
          />
        </div>

        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={values.phone}
                maxLength={20}
                onChange={(e) => set("phone", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used only to text <em>you</em> your own accountability reminders — never
                shared with brands.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder_time">Reminder time (optional)</Label>
              <Input
                id="reminder_time"
                type="time"
                value={values.reminder_time}
                onChange={(e) => set("reminder_time", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Set a time and reminders switch on automatically. Leave blank for none.
              </p>
            </div>
          </>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? isLifetime
                ? "Create account and continue"
                : "Create account"
              : "Sign in"}
        </Button>
      </form>

      <button
        className="mt-4 w-full text-center text-sm text-muted-foreground underline"
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}
      >
        {mode === "signup" ? "I already have an account" : "Create an account instead"}
      </button>
    </main>
  );
}
