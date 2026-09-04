import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { SessionStatusBadge } from "@/components/altis/StatusBadge";
import { useAltis } from "@/lib/altis/store";
import { computeSessionReport, isCompleted, sessionStatus } from "@/lib/altis/presence";
import {
  formatDate,
  formatPercent,
  participantsToWatch,
  recentCompletedSessions,
  scopeAveragePresence,
  sessionProgram,
  trainerName,
  upcomingSessions,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord - ALTIS" },
      {
        name: "description",
        content:
          "Où en est ma formation ? Prochaines sessions, activité récente et taux moyen de présence.",
      },
      { property: "og:title", content: "Tableau de bord - ALTIS" },
      {
        property: "og:description",
        content: "Prochaines sessions, activité récente et participants à surveiller.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, role, currentTrainerId } = useAltis();
  const isTrainer = role === "FORMATEUR";

  if (role === "PARTICIPANT") {
    return (
      <AppShell>
        <PageHeader
          title="Mes sessions"
          description="Retrouvez vos sessions et rejoignez la réunion en un clic."
          actions={
            <Button asChild>
              <Link to="/mes-sessions">Ouvrir mes sessions</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const visibleSessions = isTrainer
    ? data.sessions.filter((s) => s.trainerId === currentTrainerId)
    : data.sessions;

  const upcoming = upcomingSessions({ ...data, sessions: visibleSessions }, 5);
  const recent = recentCompletedSessions({ ...data, sessions: visibleSessions }, 4);
  const watch = participantsToWatch(data, visibleSessions);
  const activePrograms = data.programs.filter((p) => !p.archived).length;
  const completed = visibleSessions.filter((s) => isCompleted(s)).length;
  const participantCount = isTrainer
    ? new Set(visibleSessions.flatMap((s) => s.participantIds)).size
    : data.participants.length;

  const hasData = visibleSessions.length > 0;

  return (
    <AppShell>
      <PageHeader
        title="Tableau de bord"
        description={
          isTrainer
            ? "Vos sessions uniquement : présence réelle et activité récente."
            : "Où en est ma formation ? Vue synthétique de l'organisation."
        }
      />

      {!hasData ? (
        <Panel>
          <EmptyState
            title="Aucune session pour le moment"
            description="Créez un programme, puis ses modules et ses sessions pour commencer à mesurer la présence."
            action={
              <Button asChild>
                <Link to="/programmes">Créer un programme</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {!isTrainer && (
              <StatCard label="Programmes actifs" value={String(activePrograms)} />
            )}
            <StatCard label="Participants" value={String(participantCount)} />
            <StatCard label="Sessions réalisées" value={String(completed)} />
            <StatCard
              label="Taux moyen de présence"
              value={formatPercent(scopeAveragePresence(data, visibleSessions))}
              tone="success"
            />
            <StatCard
              label="À surveiller"
              value={String(watch.length)}
              tone={watch.length ? "warning" : "default"}
              hint="Signaux de décrochage détectés"
            />
          </div>

          <Panel title="Prochaines sessions">
            {upcoming.length === 0 ? (
              <EmptyState title="Aucune session à venir" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Nom</th>
                      <th className="px-4 py-2 font-medium">Programme</th>
                      <th className="px-4 py-2 font-medium">Formateur</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Heure</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((s) => {
                      const { program } = sessionProgram(data, s);
                      return (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/40">
                          <td className="px-4 py-2 font-medium">
                            <Link
                              to="/sessions/$sessionId"
                              params={{ sessionId: s.id }}
                              className="text-primary hover:underline"
                            >
                              {s.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{program?.name ?? "-"}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {trainerName(data, s.trainerId)}
                          </td>
                          <td className="px-4 py-2 tabular-nums">{formatDate(s.date)}</td>
                          <td className="px-4 py-2 tabular-nums">{s.startTime}</td>
                          <td className="px-4 py-2">
                            <SessionStatusBadge status={sessionStatus(s)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Activité récente">
            {recent.length === 0 ? (
              <EmptyState title="Aucune session terminée et synchronisée" />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((s) => {
                  const report = computeSessionReport(s, data.organization.attendanceSettings);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{s.name}</span> terminée.{" "}
                        {report.present}/{report.expected} participants présents -{" "}
                        {formatPercent(report.globalRate)}.
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/sessions/$sessionId" params={{ sessionId: s.id }}>
                          Voir le rapport
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}
