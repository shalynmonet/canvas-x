import { createFileRoute } from "@tanstack/react-router";
import { Paywall } from "@/components/Paywall";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/upgrade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Upgrade CanvasX — $9/month" },
      {
        name: "description",
        content: "Subscribe to CanvasX to keep tracking every brand collab after your trial.",
      },
      { property: "og:title", content: "Upgrade CanvasX" },
      { property: "og:description", content: "Keep every brand deal organized for $9/month." },
    ],
  }),
  component: () => (
    <AppShell>
      <Paywall />
    </AppShell>
  ),
});
