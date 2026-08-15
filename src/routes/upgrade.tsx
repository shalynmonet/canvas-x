import { createFileRoute } from "@tanstack/react-router";
import { Paywall } from "@/components/Paywall";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/upgrade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CanvasX plans — $14 lifetime, or $1 today only" },
      {
        name: "description",
        content:
          "Choose your CanvasX plan: a 7-day free trial then $14 once for lifetime access, or just $1 lifetime while the launch offer lasts.",
      },
      { property: "og:title", content: "CanvasX plans — $14 lifetime, or $1 today" },
      {
        property: "og:description",
        content: "Keep every brand deal organized for a one-time $14 — or $1 lifetime today only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),

  component: () => (
    <AppShell>
      <Paywall />
    </AppShell>
  ),
});
