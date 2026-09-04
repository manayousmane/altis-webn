import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/altis/Primitives";
import { SessionStatusBadge } from "@/components/altis/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { exportProgramReportToCsv } from "@/lib/altis/export";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAltis } from "@/lib/altis/store";
import { isCompleted, progression, sessionStatus } from "@/lib/altis/presence";
import {
  formatDate,
  formatPercent,
  moduleSessions,
  programModules,
  programSessions,
  scopeAveragePresence,
  trainerName,
  upcomingSessions,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/programmes/$programId")({
  head: () => ({
    meta: [
      { title: "Programme - ALTIS" },
      {
        name: "description",
        content: "Modules, sessions, participants et formateurs d'un programme de formation.",
      },
      { property: "og:title", content: "Programme - ALTIS" },
      {
        property: "og:description",
        content: "Détail d'un programme : modules, sessions et présence consolidée.",
      },
    ],
  }),
  component: ProgramPage,
});

function CreateModuleDialog({ programId }: { programId: string }) {
  const { createModule } = useAltis();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", order: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (form.name.trim().length < 2) {
      setError("Le nom du module est obligatoire (2 à 100 caractères).");
      return;
    }
    try {
      await createModule({
        programId,
        name: form.name,
        description: form.description,
        ...(form.order ? { order: Number(form.order) } : {}),
      });
      toast.success("Module ajouté");
      setForm({ name: "", description: "", order: "" });
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'ajout du module a échoué.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Ajouter un module
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau module</DialogTitle>
          <DialogDescription>L'ordre est auto-incrémenté s'il n'est pas renseigné.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Nom</Label>
            <Input
              id="module-name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-desc">Description</Label>
            <Textarea
              id="module-desc"
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-order">Ordre du module</Label>
            <Input
              id="module-order"
              type="number"
              min={1}
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={() => void submit()}>Ajouter le module</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSessionDialog({ moduleId }: { moduleId: string }) {
  const { data, createSession } = useAltis();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    startTime: "20:00",
    endTime: "21:30",
    trainerId: data.trainers[0]?.id ?? "",
    meetingUrl: "",
    createMeetAutomatically: data.organization.googleConnected,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (form.name.trim().length < 2) return setError("Le nom de la session est obligatoire.");
    if (!form.date) return setError("La date est obligatoire.");
    if (!form.trainerId) return setError("Le formateur est obligatoire.");
    if (form.endTime <= form.startTime)
      return setError("L'heure de fin doit être postérieure à l'heure de début.");

    setSubmitting(true);
    try {
      const session = await createSession({ moduleId, ...form });
      toast.success("Session créée");
      setOpen(false);
      void navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "La création de la session a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Nouvelle session
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle session</DialogTitle>
          <DialogDescription>
            Les participants du programme sont automatiquement attendus sur la session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Nom de la session</Label>
            <Input
              id="session-name"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="session-date">Date</Label>
              <Input
                id="session-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-start">Début</Label>
              <Input
                id="session-start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-end">Fin</Label>
              <Input
                id="session-end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>
          {form.date && form.date < today && (
            <p className="text-xs text-warning-foreground">
              Cette date est passée - la session sera créée mais considérée comme terminée.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="session-trainer">Formateur</Label>
            <Select
              value={form.trainerId}
              onValueChange={(value) => setForm({ ...form, trainerId: value })}
            >
              <SelectTrigger id="session-trainer">
                <SelectValue placeholder="Sélectionner un formateur" />
              </SelectTrigger>
              <SelectContent>
                {data.trainers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-meet">Lien de la réunion</Label>
            <Input
              id="session-meet"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={form.meetingUrl}
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
            />
            {data.organization.googleConnected ? (
              <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.createMeetAutomatically && !form.meetingUrl}
                  disabled={!!form.meetingUrl}
                  onChange={(e) =>
                    setForm({ ...form, createMeetAutomatically: e.target.checked })
                  }
                  className="rounded border-input text-primary"
                />
                Créer automatiquement une réunion Google Meet avec votre compte connecté
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                Laissez vide pour renseigner le lien plus tard ou connectez Google dans Paramètres pour l'automatisation.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            Créer la session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgramPage() {
  const { programId } = Route.useParams();
  const { data, role, archiveProgram } = useAltis();
  const program = data.programs.find((p) => p.id === programId);

  if (!program) {
    return (
      <AppShell>
        <Panel>
          <EmptyState title="Programme introuvable" />
        </Panel>
      </AppShell>
    );
  }

  const modules = programModules(data, program.id);
  const sessions = programSessions(data, program.id);
  const trainers = data.trainers.filter((t) => sessions.some((s) => s.trainerId === t.id));
  const isOrg = role === "ORGANISATION";

  return (
    <AppShell>
      <PageHeader
        breadcrumb={
          <Link to="/programmes" className="text-xs text-muted-foreground hover:underline">
            Programmes
          </Link>
        }
        title={program.name}
        description={program.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                exportProgramReportToCsv(program, data);
                toast.success("Bilan du programme exporté au format CSV");
              }}
            >
              <Download className="size-4" aria-hidden />
              Exporter le bilan (CSV)
            </Button>
            {isOrg && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await archiveProgram(program.id);
                    toast.success("Programme archivé");
                  }}
                  disabled={program.archived}
                >
                  {program.archived ? "Archivé" : "Archiver"}
                </Button>
                <CreateModuleDialog programId={program.id} />
              </>
            )}
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">
        {program.startDate ? `Du ${formatDate(program.startDate)}` : "Dates non renseignées"}
        {program.endDate ? ` au ${formatDate(program.endDate)}` : ""}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Participants" value={String(program.participantIds.length)} />
        <StatCard label="Modules" value={String(modules.length)} />
        <StatCard label="Sessions" value={String(sessions.length)} />
        <StatCard
          label="Taux de présence"
          value={formatPercent(scopeAveragePresence(data, sessions))}
          tone="success"
        />
        <StatCard label="Progression" value={formatPercent(progression(sessions))} />
      </div>

      <Tabs defaultValue="apercu">
        <TabsList>
          <TabsTrigger value="apercu">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="formateurs">Formateurs</TabsTrigger>
          <TabsTrigger value="presences">Présences</TabsTrigger>
        </TabsList>

        <TabsContent value="apercu" className="space-y-4">
          <Panel title="Prochaines sessions du programme">
            {upcomingSessions({ ...data, sessions }, 5).length === 0 ? (
              <EmptyState title="Aucune session à venir" />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingSessions({ ...data, sessions }, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <Link
                      to="/sessions/$sessionId"
                      params={{ sessionId: s.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      {formatDate(s.date)} · {s.startTime}
                      <SessionStatusBadge status={sessionStatus(s)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          {modules.length === 0 ? (
            <Panel>
              <EmptyState
                title="Aucun module"
                description="Ajoutez un module pour organiser les sessions du programme."
              />
            </Panel>
          ) : (
            modules.map((mod) => {
              const modSessions = moduleSessions(data, mod.id);
              return (
                <Panel
                  key={mod.id}
                  title={`MODULE ${mod.order} - ${mod.name}`}
                  description={`${modSessions.length} sessions · ${formatPercent(
                    scopeAveragePresence(data, modSessions),
                  )} de présence`}
                  actions={isOrg ? <CreateSessionDialog moduleId={mod.id} /> : undefined}
                >
                  {modSessions.length === 0 ? (
                    <EmptyState title="Aucune session dans ce module" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {modSessions.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                        >
                          <Link
                            to="/sessions/$sessionId"
                            params={{ sessionId: s.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {s.name}
                          </Link>
                          <span className="flex items-center gap-3 text-muted-foreground">
                            <span className="tabular-nums">
                              {formatDate(s.date)} · {s.startTime}–{s.endTime}
                            </span>
                            {trainerName(data, s.trainerId)}
                            <SessionStatusBadge status={sessionStatus(s)} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="participants">
          <Panel title="Participants inscrits">
            {program.participantIds.length === 0 ? (
              <EmptyState title="Aucun participant inscrit" />
            ) : (
              <ul className="divide-y divide-border">
                {program.participantIds.map((id) => {
                  const p = data.participants.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <li key={id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <Link
                        to="/participants/$participantId"
                        params={{ participantId: id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                      <span className="text-muted-foreground">{p.email}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="formateurs">
          <Panel title="Formateurs intervenants">
            {trainers.length === 0 ? (
              <EmptyState title="Aucun formateur assigné" />
            ) : (
              <ul className="divide-y divide-border">
                {trainers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Link
                      to="/formateurs/$trainerId"
                      params={{ trainerId: t.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.firstName} {t.lastName}
                    </Link>
                    <span className="text-muted-foreground">
                      {sessions.filter((s) => s.trainerId === t.id).length} sessions
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="presences">
          <Panel title="Présence consolidée">
            <div className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">
                {sessions.filter((s) => isCompleted(s)).length} sessions synchronisées ·{" "}
                {formatPercent(scopeAveragePresence(data, sessions))} de présence moyenne.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/pilotage" search={{ programId: program.id }}>
                  Ouvrir le Pilotage filtré sur ce programme
                </Link>
              </Button>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}