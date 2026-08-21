import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { CollabForm } from "@/components/CollabForm";

export const Route = createFileRoute("/_authenticated/collabs/new")({
  head: () => ({
    meta: [
      { title: "Add a collab — CanvOps" },
      {
        name: "description",
        content:
          "Add a brand collab with calibrated warmup, engagement and posting defaults from real creators.",
      },
      { property: "og:title", content: "Add a collab — CanvOps" },
      {
        property: "og:description",
        content: "Set up a new brand deal with creator-calibrated defaults.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <AccessGate>
        <NewCollab />
      </AccessGate>
    </AppShell>
  ),
});

function NewCollab() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Add collab</h1>
      <CollabForm
        onSaved={(id) => navigate({ to: "/collabs/$id", params: { id } })}
        onCancel={() => navigate({ to: "/home" })}
      />
    </div>
  );
}
