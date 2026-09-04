import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/altis/Primitives";
import { WatchBadge } from "@/components/altis/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InviteMemberDialog } from "@/components/altis/InviteMemberDialog";
import { useAltis } from "@/lib/altis/store";
import { computeParticipantInsight } from "@/lib/altis/presence";
import { formatPercent, participantPrograms } from "@/lib/altis/selectors";
import { exportParticipantsToCsv } from "@/lib/altis/export";

export const Route = createFileRoute("/_authenticated/participants/")({
  head: () => ({
    meta: [
      { title: "Participants - ALTIS" },
      {
        name: "description",
        content:
          "Tous les participants de l'organisation avec leur taux de présence et leur statut de suivi.",
      },
      { property: "og:title", content: "Participants - ALTIS" },
      {
        property: "og:description",
        content: "Recherchez, filtrez et suivez la présence de vos participants.",
      },
    ],
  }),
  component: ParticipantsPage,
});

function ParticipantsPage() {
  const { data } = useAltis();
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = data.participants
    .map((p) => ({
      participant: p,
      insight: computeParticipantInsight(p.id, data.sessions, data.organization.attendanceSettings),
      programs: participantPrograms(data, p.id),
    }))
    .filter(({ participant, insight, programs }) => {
      const q = search.trim().toLowerCase();
      if (
        q &&
        !`${participant.firstName} ${participant.lastName} ${participant.email}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (programFilter !== "all" && !programs.some((pr) => pr.id === programFilter)) return false;
      if (statusFilter === "watch" && !insight.toWatch) return false;
      if (statusFilter === "active" && insight.toWatch) return false;
      return true;
    });

  return (
    <AppShell>
      <PageHeader
        title="Participants"
        description="Liste globale des participants de l'organisation."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const currentFilteredParticipants = rows.map((r) => r.participant);
                exportParticipantsToCsv(currentFilteredParticipants, data);
                toast.success("Liste des participants exportée au format CSV");
              }}
            >
              <Download className="size-4" aria-hidden />
              Exporter la liste (CSV)
            </Button>
            <InviteMemberDialog kind="PARTICIPANT" />
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Rechercher par nom ou email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un participant"
        />
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-56" aria-label="Filtrer par programme">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="watch">À surveiller</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="Aucun participant ne correspond à ces critères" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Participant</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Téléphone</th>
                  <th className="px-4 py-2 font-medium">Programmes</th>
                  <th className="px-4 py-2 font-medium">Présence moyenne</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ participant, insight, programs }) => (
                  <tr key={participant.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to="/participants/$participantId"
                        params={{ participantId: participant.id }}
                        className="text-primary hover:underline"
                      >
                        {participant.firstName} {participant.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{participant.email}</td>
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">
                      {participant.phone ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {programs.map((pr) => (
                          <span
                            key={pr.id}
                            className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {pr.name}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatPercent(insight.averageRate)}
                    </td>
                    <td className="px-4 py-2">
                      <WatchBadge toWatch={insight.toWatch} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}