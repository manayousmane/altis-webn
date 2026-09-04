import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Copy, Download, Printer, RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { InfoBadge, PresenceBadge, SessionStatusBadge } from "@/components/altis/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAltis } from "@/lib/altis/store";
import { parseMeetReport } from "@/lib/altis/meet-report";
import {
  computeSessionReport,
  scheduledDuration,
  sessionStatus,
} from "@/lib/altis/presence";
import {
  exportSessionReportToCsv,
  printSessionAttendanceSheet,
} from "@/lib/altis/export";
import {
  formatDate,
  formatMinutes,
  formatPercent,
  formatTime,
  participantName,
  sessionProgram,
  trainerName,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session - ALTIS" },
      {
        name: "description",
        content:
          "Rapport de présence détaillé d'une session : durée cumulée, retard, départ anticipé et reconnexions.",
      },
      { property: "og:title", content: "Session - ALTIS" },
      {
        property: "og:description",
        content: "Présence réelle par participant, calculée depuis les données Google Meet.",
      },
    ],
  }),
  component: SessionPage,
});

function MeetingLinkDialog({
  sessionId,
  currentUrl,
}: {
  sessionId: string;
  currentUrl?: string | undefined;
}) {
  const { setSessionMeeting } = useAltis();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^https?:\/\/\S+$/.test(url.trim())) {
      setError("Renseignez une URL de réunion valide (https://...).");
      return;
    }
    try {
      await setSessionMeeting(sessionId, url);
      toast.success("Lien de réunion enregistré");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {currentUrl ? "Modifier le lien" : "Ajouter le lien de réunion"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lien de la réunion</DialogTitle>
          <DialogDescription>
            Collez le lien Google Meet, Teams ou Zoom de cette session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="meeting-url">URL</Label>
          <Input
            id="meeting-url"
            value={url}
            placeholder="https://meet.google.com/abc-defg-hij"
            onChange={(e) => setUrl(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={() => void submit()}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportAttendanceDialog({ sessionId }: { sessionId: string }) {
  const { data, importAttendance } = useAltis();
  const session = data.sessions.find((s) => s.id === sessionId);
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!session) return;
    const parsed = parseMeetReport(raw, session.date);
    if (parsed.rows.length === 0) {
      setError("Aucune ligne exploitable détectée. Attendu : email, heure d'arrivée, heure de départ.");
      return;
    }
    const byEmail = new Map(
      data.participants.map((p) => [p.email.toLowerCase(), p.id] as const),
    );
    const rows = parsed.rows
      .map((r) => {
        const participantId = byEmail.get(r.email);
        return participantId ? { participantId, joinedAt: r.joinedAt, leftAt: r.leftAt } : null;
      })
      .filter((r): r is { participantId: string; joinedAt: string; leftAt: string | null } => !!r);

    if (rows.length === 0) {
      setError("Aucun email du rapport ne correspond à un participant enregistré.");
      return;
    }

    setPending(true);
    try {
      await importAttendance(sessionId, rows);
      toast.success(`${rows.length} lignes de présence importées`);
      setOpen(false);
      setRaw("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Importer le rapport de participation</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer les données de connexion</DialogTitle>
          <DialogDescription>
            Collez le rapport de participation (CSV ou tableur). Une ligne par connexion : email,
            heure d'arrivée, heure de départ. Les données brutes sont conservées telles quelles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="report">Rapport</Label>
          <Textarea
            id="report"
            rows={8}
            value={raw}
            placeholder={"marie@exemple.fr,20:02,21:28\npaul@exemple.fr,20:15,21:30"}
            onChange={(e) => setRaw(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { data, role, cancelSession, generateSessionMeeting, syncSession } = useAltis();
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [syncingAttendance, setSyncingAttendance] = useState(false);
  const session = data.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <AppShell>
        <Panel>
          <EmptyState title="Session introuvable" />
        </Panel>
      </AppShell>
    );
  }

  const { program, module } = sessionProgram(data, session);
  const status = sessionStatus(session);
  const report = computeSessionReport(session, data.organization.attendanceSettings);
  const isOrg = role === "ORGANISATION";
  const showReport = status === "TERMINEE" && session.synced;

  const handleGenerateMeet = async () => {
    setGeneratingMeet(true);
    try {
      await generateSessionMeeting(session.id);
      toast.success("Réunion Google Meet créée avec succès");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de génération Google Meet.");
    } finally {
      setGeneratingMeet(false);
    }
  };

  const handleSyncAttendance = async () => {
    setSyncingAttendance(true);
    try {
      const res = await syncSession(session.id);
      toast.success(
        `Présences synchronisées : ${res.recordsCount} connexion(s) pour ${res.matchedParticipantsCount} participant(s).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la synchronisation.");
    } finally {
      setSyncingAttendance(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        breadcrumb={
          <p className="text-xs text-muted-foreground">
            {program ? (
              <Link
                to="/programmes/$programId"
                params={{ programId: program.id }}
                className="hover:underline"
              >
                {program.name}
              </Link>
            ) : (
              "-"
            )}
            {module ? ` › ${module.name}` : ""}
          </p>
        }
        title={session.name}
        description={`${formatDate(session.date)} · ${session.startTime}–${session.endTime} · ${trainerName(
          data,
          session.trainerId,
        )} · durée programmée ${formatMinutes(scheduledDuration(session))}`}
        actions={
          <>
            <SessionStatusBadge status={status} />
            {isOrg && status !== "ANNULEE" && status !== "TERMINEE" && (
              <Button
                variant="outline"
                onClick={async () => {
                  await cancelSession(session.id);
                  toast.success("Session annulée");
                }}
              >
                Annuler la session
              </Button>
            )}
          </>
        }
      />

      <Panel title="Réunion">
        <div className="space-y-3 p-4 text-sm">
          {session.meeting ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <a href={session.meeting.url} target="_blank" rel="noreferrer">
                  <Video className="size-4" aria-hidden /> Rejoindre la réunion
                </a>
              </Button>
              <code className="rounded border border-border bg-muted px-2 py-1 text-xs">
                {session.meeting.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(session.meeting!.url);
                  toast.success("Lien copié");
                }}
              >
                <Copy className="size-4" aria-hidden /> Copier
              </Button>
              {isOrg && (
                <MeetingLinkDialog sessionId={session.id} currentUrl={session.meeting.url} />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
                {session.integrationError ?? "Aucune réunion associée à cette session."}
              </p>
              {isOrg && (
                <div className="flex flex-wrap items-center gap-2">
                  {data.organization.googleConnected && (
                    <Button
                      onClick={() => void handleGenerateMeet()}
                      disabled={generatingMeet}
                    >
                      <Video className="size-4" aria-hidden />
                      {generatingMeet
                        ? "Création de la réunion…"
                        : session.integrationError
                          ? "Réessayer la création Google Meet"
                          : "Générer la réunion Google Meet"}
                    </Button>
                  )}
                  <MeetingLinkDialog sessionId={session.id} />
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Participants attendus"
        description={`${session.participantIds.length} participants`}
      >
        {session.participantIds.length === 0 ? (
          <EmptyState title="Aucun participant attendu" />
        ) : (
          <ul className="grid gap-1 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {session.participantIds.map((id) => (
              <li key={id}>
                <Link
                  to="/participants/$participantId"
                  params={{ participantId: id }}
                  className="text-primary hover:underline"
                >
                  {participantName(data, id)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {status === "PROGRAMMEE" || status === "ERREUR_INTEGRATION" ? (
        <Panel title="Rapport de présence">
          <EmptyState title="Le rapport sera disponible après la session." />
        </Panel>
      ) : status === "EN_COURS" ? (
        <Panel title="Rapport de présence">
          <EmptyState
            title="Session en cours"
            description="Le rapport n'est pas affiché pendant la session pour éviter des données incomplètes."
          />
        </Panel>
      ) : !session.synced ? (
        <Panel title="Rapport de présence">
          <EmptyState
            title="Données de connexion non importées"
            description={
              data.organization.googleConnected && session.meeting
                ? "Synchronisez les connexions depuis Google Meet pour calculer la présence réelle."
                : "Importez le rapport de participation de la réunion pour calculer la présence réelle."
            }
            action={
              isOrg ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {data.organization.googleConnected && session.meeting && (
                    <Button
                      onClick={() => void handleSyncAttendance()}
                      disabled={syncingAttendance}
                    >
                      <RefreshCw
                        className={cn("size-4", syncingAttendance && "animate-spin")}
                        aria-hidden
                      />
                      {syncingAttendance
                        ? "Synchronisation en cours…"
                        : "Synchroniser les présences Google Meet"}
                    </Button>
                  )}
                  <ImportAttendanceDialog sessionId={session.id} />
                </div>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        showReport && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Participants attendus" value={String(report.expected)} />
              <StatCard label="Présents" value={String(report.present)} tone="success" />
              <StatCard
                label="Partiellement présents"
                value={String(report.partial)}
                tone="warning"
              />
              <StatCard label="Absents" value={String(report.absent)} tone="danger" />
              <StatCard label="Taux de présence" value={formatPercent(report.globalRate)} />
            </div>

            <Panel
              title="Détail par participant"
              description="Données brutes Google Meet conservées ; indicateurs recalculables."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exportSessionReportToCsv(report, data);
                      toast.success("Rapport CSV exporté avec succès");
                    }}
                  >
                    <Download className="size-3.5" aria-hidden />
                    Exporter CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      printSessionAttendanceSheet(report, data);
                    }}
                  >
                    <Printer className="size-3.5" aria-hidden />
                    Imprimer / PDF
                  </Button>
                  {isOrg && data.organization.googleConnected && session.meeting && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSyncAttendance()}
                      disabled={syncingAttendance}
                    >
                      <RefreshCw
                        className={cn("size-3.5", syncingAttendance && "animate-spin")}
                        aria-hidden
                      />
                      {syncingAttendance ? "Synchronisation…" : "Synchroniser à nouveau"}
                    </Button>
                  )}
                  {isOrg && <ImportAttendanceDialog sessionId={session.id} />}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Participant</th>
                      <th className="px-4 py-2 font-medium">1re connexion</th>
                      <th className="px-4 py-2 font-medium">Dern. déconnexion</th>
                      <th className="px-4 py-2 font-medium">Durée cumulée</th>
                      <th className="px-4 py-2 font-medium">Retard</th>
                      <th className="px-4 py-2 font-medium">Départ anticipé</th>
                      <th className="px-4 py-2 font-medium">Reconnexions</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.participantId} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">
                          <Link
                            to="/participants/$participantId"
                            params={{ participantId: row.participantId }}
                            className="text-primary hover:underline"
                          >
                            {participantName(data, row.participantId)}
                          </Link>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {row.unstableConnection && <InfoBadge>Connexion instable</InfoBadge>}
                            {row.incompleteData && (
                              <InfoBadge>Donnée potentiellement incomplète</InfoBadge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2 tabular-nums">{formatTime(row.firstJoin)}</td>
                        <td className="px-4 py-2 tabular-nums">{formatTime(row.lastLeave)}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {formatMinutes(row.cumulativeMinutes)}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatPercent(Math.min(100, row.attendanceRate), 1)})
                          </span>
                        </td>
                        <td
                          className={
                            row.significantLate
                              ? "px-4 py-2 font-medium text-warning-foreground tabular-nums"
                              : "px-4 py-2 tabular-nums"
                          }
                        >
                          {row.lateMinutes} min
                        </td>
                        <td
                          className={
                            row.significantEarlyLeave
                              ? "px-4 py-2 font-medium text-warning-foreground tabular-nums"
                              : "px-4 py-2 tabular-nums"
                          }
                        >
                          {row.earlyLeaveMinutes} min
                        </td>
                        <td className="px-4 py-2 tabular-nums">{row.reconnections}</td>
                        <td className="px-4 py-2">
                          <PresenceBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )
      )}
    </AppShell>
  );
}