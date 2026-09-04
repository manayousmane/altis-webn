import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { WatchBadge } from "@/components/altis/StatusBadge";
import { PresenceChart } from "@/components/altis/PresenceChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAltis } from "@/lib/altis/store";
import { isCompleted, progression } from "@/lib/altis/presence";
import {
  formatPercent,
  participantName,
  participantsToWatch,
  presenceTrend,
  programSessions,
  scopeAveragePresence,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/pilotage")({
  validateSearch: (search: Record<string, unknown>) => ({
    programId: typeof search["programId"] === "string" ? (search["programId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pilotage - ALTIS" },
      {
        name: "description",
        content:
          "Vue analytique de la présence : taux global, avancement des programmes et participants à surveiller.",
      },
      { property: "og:title", content: "Pilotage - ALTIS" },
      {
        property: "og:description",
        content: "Analysez l'évolution de la présence et repérez les signaux de décrochage.",
      },
    ],
  }),
  component: PilotagePage,
});

function PilotagePage() {
  const { programId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, role, currentTrainerId } = useAltis();

  const baseSessions =
    role === "FORMATEUR"
      ? data.sessions.filter((s) => s.trainerId === currentTrainerId)
      : data.sessions;
  const sessions = programId
    ? baseSessions.filter((s) => programSessions(data, programId).some((ps) => ps.id === s.id))
    : baseSessions;

  const completed = sessions.filter((s) => isCompleted(s));
  const watchlist = participantsToWatch(data, sessions);

  return (
    <AppShell>
      <PageHeader
        title="Pilotage"
        description="Analyse consolidée de la présence sur votre périmètre."
        actions={
          <Select
            value={programId ?? "all"}
            onValueChange={(value) =>
              navigate({
                search: { programId: value === "all" ? undefined : value },
              })
            }
          >
            <SelectTrigger className="w-64" aria-label="Filtrer par programme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les programmes</SelectItem>
              {data.programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Présence moyenne"
          value={formatPercent(scopeAveragePresence(data, sessions))}
          hint="Sessions terminées et synchronisées"
          tone="success"
        />
        <StatCard label="Sessions terminées" value={String(completed.length)} />
        <StatCard
          label="Avancement"
          value={formatPercent(progression(sessions))}
          hint={`${completed.length}/${sessions.length} sessions`}
        />
        <StatCard
          label="À surveiller"
          value={String(watchlist.length)}
          tone={watchlist.length > 0 ? "warning" : "default"}
        />
      </div>

      <Panel title="Évolution du taux de présence">
        <div className="p-4">
          {completed.length === 0 ? (
            <EmptyState
              title="Pas encore de données"
              description="Les courbes apparaîtront après la synchronisation des premières sessions."
            />
          ) : (
            <PresenceChart data={presenceTrend(data, sessions)} />
          )}
        </div>
      </Panel>

      <Panel
        title="Participants à surveiller"
        description="Signaux calculés à partir des données de présence, sans action automatique."
      >
        {watchlist.length === 0 ? (
          <EmptyState title="Aucun signal de décrochage détecté" />
        ) : (
          <ul className="divide-y divide-border">
            {watchlist.map((insight) => (
              <li key={insight.participantId} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {participantName(data, insight.participantId)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatPercent(insight.averageRate)} de présence
                    </span>
                    <WatchBadge toWatch />
                  </span>
                </div>
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {insight.signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}