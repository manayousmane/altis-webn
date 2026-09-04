import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { SessionStatusBadge } from "@/components/altis/StatusBadge";
import { PresenceChart } from "@/components/altis/PresenceChart";
import { useAltis } from "@/lib/altis/store";
import { isCompleted, sessionStatus } from "@/lib/altis/presence";
import {
  formatDate,
  formatPercent,
  presenceTrend,
  scopeAveragePresence,
  sortByDate,
  trainerSessions,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/formateurs/$trainerId")({
  head: () => ({
    meta: [
      { title: "Fiche formateur - ALTIS" },
      {
        name: "description",
        content: "Sessions animées par un formateur et présence moyenne de ses groupes.",
      },
      { property: "og:title", content: "Fiche formateur - ALTIS" },
      {
        property: "og:description",
        content: "Activité du formateur : sessions à venir, terminées et tendance de présence.",
      },
    ],
  }),
  component: TrainerPage,
});

function TrainerPage() {
  const { trainerId } = Route.useParams();
  const { data } = useAltis();
  const trainer = data.trainers.find((t) => t.id === trainerId);

  if (!trainer) {
    return (
      <AppShell>
        <Panel>
          <EmptyState title="Formateur introuvable" />
        </Panel>
      </AppShell>
    );
  }

  const sessions = trainerSessions(data, trainer.id);
  const completed = sessions.filter((s) => isCompleted(s));

  return (
    <AppShell>
      <PageHeader
        breadcrumb={
          <Link to="/formateurs" className="text-xs text-muted-foreground hover:underline">
            Formateurs
          </Link>
        }
        title={`${trainer.firstName} ${trainer.lastName}`}
        description={trainer.email}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sessions planifiées" value={String(sessions.length)} />
        <StatCard label="Sessions terminées" value={String(completed.length)} />
        <StatCard
          label="Présence moyenne"
          value={formatPercent(scopeAveragePresence(data, sessions))}
          tone="success"
        />
      </div>

      <Panel title="Évolution de la présence">
        <div className="p-4">
          <PresenceChart data={presenceTrend(data, sessions)} />
        </div>
      </Panel>

      <Panel title="Sessions">
        {sessions.length === 0 ? (
          <EmptyState title="Aucune session assignée" />
        ) : (
          <ul className="divide-y divide-border">
            {sortByDate(sessions, "desc").map((session) => (
              <li key={session.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <Link
                    to="/sessions/$sessionId"
                    params={{ sessionId: session.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {session.name}
                  </Link>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(session.date)} · {session.startTime}–{session.endTime}
                  </p>
                </div>
                <SessionStatusBadge status={sessionStatus(session)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}