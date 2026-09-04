import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { PresenceBadge, SessionStatusBadge } from "@/components/altis/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAltis } from "@/lib/altis/store";
import {
  computeParticipantInsight,
  computeParticipantSession,
  isCompleted,
  sessionStatus,
} from "@/lib/altis/presence";
import { formatDate, formatMinutes, formatPercent, sortByDate } from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/mes-sessions")({
  head: () => ({
    meta: [
      { title: "Mes sessions - ALTIS" },
      {
        name: "description",
        content:
          "Vue participant : sessions à venir, lien de réunion et historique de votre présence.",
      },
      { property: "og:title", content: "Mes sessions - ALTIS" },
      {
        property: "og:description",
        content: "Rejoignez vos sessions et consultez votre historique de présence.",
      },
    ],
  }),
  component: MySessionsPage,
});

function MySessionsPage() {
  const { data, currentParticipantId } = useAltis();
  const settings = data.organization.attendanceSettings;

  const mine = data.sessions.filter((s) => s.participantIds.includes(currentParticipantId));
  const upcoming = sortByDate(mine.filter((s) => !isCompleted(s)));
  const past = sortByDate(mine.filter((s) => isCompleted(s)), "desc");
  const insight = computeParticipantInsight(currentParticipantId, data.sessions, settings);

  return (
    <AppShell>
      <PageHeader
        title="Mes sessions"
        description="Vos prochaines sessions et votre historique de présence."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sessions à venir" value={String(upcoming.length)} />
        <StatCard label="Sessions suivies" value={String(insight.attended)} />
        <StatCard
          label="Ma présence moyenne"
          value={formatPercent(insight.averageRate)}
          tone="success"
        />
      </div>

      <Panel title="À venir">
        {upcoming.length === 0 ? (
          <EmptyState title="Aucune session planifiée" />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{session.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(session.date)} · {session.startTime}–{session.endTime}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SessionStatusBadge status={sessionStatus(session)} />
                  {session.meeting ? (
                    <Button asChild size="sm">
                      <a href={session.meeting.url} target="_blank" rel="noreferrer">
                        Rejoindre
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Lien à venir</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Mon historique">
        {past.length === 0 ? (
          <EmptyState title="Aucune session terminée" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Session</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Ma durée</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {past.map((session) => {
                  const row = computeParticipantSession(session, currentParticipantId, settings);
                  return (
                    <tr key={session.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{session.name}</td>
                      <td className="px-4 py-2 tabular-nums">{formatDate(session.date)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatMinutes(row.cumulativeMinutes)}
                      </td>
                      <td className="px-4 py-2">
                        <PresenceBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}