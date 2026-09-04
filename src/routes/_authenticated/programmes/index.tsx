import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
import { AppShell } from "@/components/altis/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/altis/Primitives";
import { useAltis } from "@/lib/altis/store";
import {
  formatPercent,
  programModules,
  programSessions,
  scopeAveragePresence,
} from "@/lib/altis/selectors";

export const Route = createFileRoute("/_authenticated/programmes/")({
  head: () => ({
    meta: [
      { title: "Programmes - ALTIS" },
      {
        name: "description",
        content: "Vue d'ensemble des programmes de formation : modules, sessions et taux de présence.",
      },
      { property: "og:title", content: "Programmes - ALTIS" },
      {
        property: "og:description",
        content: "Créez et pilotez vos programmes, modules et sessions de formation.",
      },
    ],
  }),
  component: ProgramsPage,
});

function CreateProgramDialog() {
  const { createProgram } = useAltis();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", startDate: "", endDate: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Le nom du programme est obligatoire (2 à 100 caractères).");
      return;
    }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError("La date de début doit être antérieure ou égale à la date de fin.");
      return;
    }
    setSubmitting(true);
    try {
      const program = await createProgram(form);
      toast.success("Programme créé");
      setOpen(false);
      setForm({ name: "", description: "", startDate: "", endDate: "" });
      void navigate({ to: "/programmes/$programId", params: { programId: program.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "La création a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>+ Nouveau programme</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau programme</DialogTitle>
          <DialogDescription>
            Le nom est obligatoire. Les dates sont facultatives mais doivent être cohérentes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Nom du programme</Label>
            <Input
              id="program-name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="PAJE ACADEMY"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-desc">Description</Label>
            <Textarea
              id="program-desc"
              value={form.description}
              maxLength={1000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-start">Date de début</Label>
              <Input
                id="program-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-end">Date de fin</Label>
              <Input
                id="program-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            Créer le programme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgramsPage() {
  const { data, role, currentTrainerId } = useAltis();
  const [search, setSearch] = useState("");

  const visible = data.programs.filter((p) => {
    if (role === "FORMATEUR") {
      const sessions = programSessions(data, p.id);
      if (!sessions.some((s) => s.trainerId === currentTrainerId)) return false;
    }
    return p.name.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <AppShell>
      <PageHeader
        title="Programmes"
        description={
          role === "FORMATEUR"
            ? "Programmes auxquels vous êtes associé (lecture seule)."
            : "Vue d'ensemble de tous les programmes de l'organisation."
        }
        actions={role === "ORGANISATION" ? <CreateProgramDialog /> : undefined}
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un programme"
        className="max-w-sm"
        aria-label="Rechercher un programme"
      />

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            title="Aucun programme pour le moment"
            description="Créez votre premier programme pour organiser modules et sessions."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((program) => {
            const modules = programModules(data, program.id);
            const sessions = programSessions(data, program.id);
            return (
              <Link
                key={program.id}
                to="/programmes/$programId"
                params={{ programId: program.id }}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
              >
                <p className="text-sm font-semibold tracking-tight">{program.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {program.participantIds.length} participants · {modules.length} modules ·{" "}
                  {sessions.length} sessions · {formatPercent(scopeAveragePresence(data, sessions))}{" "}
                  de présence
                </p>
                {program.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {program.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}