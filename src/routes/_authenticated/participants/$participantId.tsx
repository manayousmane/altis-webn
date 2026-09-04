import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { PresenceBadge, WatchBadge } from "@/components/altis/StatusBadge";
import { Sparkline } from "@/components/altis/PresenceChart";
import { useAltis } from "@/lib/altis/store";
import { computeParticipantInsight, computeParticipantSession, isCompleted } from "@/lib/altis/presence";
import {
  formatDate,
  formatMinutes,
  formatPercent,
  participantPrograms,
  sortByDate,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/participants/$participantId")({
  head: () => ({
    meta: [
      { title: "Fiche participant - ALTIS" },
      {
        name: "description",
        content:
          "Historique de présence d'un participant, score de présence et signaux de décrochage détectés.",
      },
      { property: "og:title", content: "Fiche participant - ALTIS" },
      {
        property: "og:description",
        content: "Sessions suivies, sessions manquées et évolution récente de la présence.",
      },
    ],
  }),
  component: ParticipantPage,
});

function ParticipantPage() {
  const { participantId } = Route.useParams();
  const { data } = useAltis();
  const participant = data.participants.find((p) => p.id === participantId);

  if (!participant) {
    return (
      <AppShell>
        <Panel>
          <EmptyState title="Participant introuvable" />
        </Panel>
      </AppShell>
    );
  }

  const settings = data.organization.attendanceSettings;
  const insight = computeParticipantInsight(participant.id, data.sessions, settings);
  const programs = participantPrograms(data, participant.id);
  const history = sortByDate(
    data.sessions.filter((s) => s.participantIds.includes(participant.id) && isCompleted(s)),
    "desc",
  );

  return (
    <AppShell>
      <PageHeader
        breadcrumb={
          <Link to="/participants" className="text-xs text-muted-foreground hover:underline">
            Participants
          </Link>
        }
        title={`${participant.firstName} ${participant.lastName}`}
        description={`${participant.email}${participant.phone ? ` · ${participant.phone}` : ""}`}
        actions={<WatchBadge toWatch={insight.toWatch} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sessions suivies" value={String(insight.attended)} />
        <StatCard label="Sessions manquées" value={String(insight.missed)} tone="danger" />
        <StatCard
          label="Score de présence"
          value={formatPercent(insight.presenceScore)}
          hint="Sessions passées et synchronisées"
          tone="success"
        />
        <StatCard
          label="Tendance récente"
          value={
            insight.trend === "BAISSE" ? "À la baisse" : insight.trend === "HAUSSE" ? "À la hausse" : "Stable"
          }
          tone={insight.trend === "BAISSE" ? "warning" : "default"}
        />
      </div>

      {insight.signals.length > 0 && (
        <Panel title="Signaux de décrochage détectés">
          <div className="space-y-2 p-4 text-sm">
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {insight.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Indicateur basé sur les données de présence - aucune action automatique n'est déclenchée.
            </p>
          </div>
        </Panel>
      )}

      <Panel title="Évolution des 5 dernières sessions">
        <div className="flex items-center gap-4 p-4">
          <Sparkline points={insight.history.slice(-5).map((h) => h.rate)} />
          <span className="text-sm text-muted-foreground">
            {insight.history.slice(-5).map((h) => `${h.rate} %`).join(" → ") || "-"}
          </span>
        </div>
      </Panel>

      <Panel title="Programmes suivis">
        {programs.length === 0 ? (
          <EmptyState title="Aucun programme" />
        ) : (
          <ul className="divide-y divide-border">
            {programs.map((p) => (
              <li key={p.id} className="px-4 py-2.5 text-sm">
                <Link
                  to="/programmes/$programId"
                  params={{ programId: p.id }}
                  className="text-primary hover:underline"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Historique des sessions">
        {history.length === 0 ? (
          <EmptyState title="Aucune session synchronisée" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Session</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Durée</th>
                  <th className="px-4 py-2 font-medium">Retard</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {history.map((session) => {
                  const row = computeParticipantSession(session, participant.id, settings);
                  return (
                    <tr key={session.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">
                        <Link
                          to="/sessions/$sessionId"
                          params={{ sessionId: session.id }}
                          className="text-primary hover:underline"
                        >
                          {session.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 tabular-nums">{formatDate(session.date)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatMinutes(row.cumulativeMinutes)}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{row.lateMinutes} min</td>
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