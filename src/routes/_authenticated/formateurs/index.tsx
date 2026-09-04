import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/altis/Primitives";
import { InviteMemberDialog } from "@/components/altis/InviteMemberDialog";
import { useAltis } from "@/lib/altis/store";
import { formatPercent, scopeAveragePresence, trainerSessions } from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/formateurs/")({
  head: () => ({
    meta: [
      { title: "Formateurs - ALTIS" },
      {
        name: "description",
        content: "Formateurs de l'organisation, sessions dirigées et présence moyenne constatée.",
      },
      { property: "og:title", content: "Formateurs - ALTIS" },
      {
        property: "og:description",
        content: "Liste des formateurs et performance de présence de leurs sessions.",
      },
    ],
  }),
  component: TrainersPage,
});

function TrainersPage() {
  const { data, role } = useAltis();

  if (role !== "ORGANISATION") {
    return (
      <AppShell>
        <Panel>
          <EmptyState
            title="Accès restreint"
            description="Seul le rôle Organisation accède à la liste globale des formateurs."
          />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Formateurs"
        description="Liste globale des formateurs de l'organisation."
        actions={<InviteMemberDialog kind="FORMATEUR" />}
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Formateur</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Sessions dirigées</th>
                <th className="px-4 py-2 font-medium">Présence moyenne</th>
              </tr>
            </thead>
            <tbody>
              {data.trainers.map((t) => {
                const sessions = trainerSessions(data, t.id);
                return (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to="/formateurs/$trainerId"
                        params={{ trainerId: t.id }}
                        className="text-primary hover:underline"
                      >
                        {t.firstName} {t.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{t.email}</td>
                    <td className="px-4 py-2 tabular-nums">{sessions.length}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatPercent(scopeAveragePresence(data, sessions))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}