import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/altis/AppShell";
import { PageHeader, Panel } from "@/components/altis/Primitives";
import { InfoBadge } from "@/components/altis/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAltis } from "@/lib/altis/store";
import { DEFAULT_ATTENDANCE_SETTINGS } from "@/lib/altis/presence";
import type { AttendanceSettings } from "@/lib/altis/types";

import { useServerFn } from "@tanstack/react-start";
import { getGoogleAuthUrl } from "@/lib/altis/google.functions";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres - ALTIS" },
      {
        name: "description",
        content:
          "Configurez les seuils de présence, de retard et de départ anticipé, et la connexion Google Meet.",
      },
      { property: "og:title", content: "Paramètres - ALTIS" },
      {
        property: "og:description",
        content: "Seuils de calcul de présence et intégration visioconférence de l'organisation.",
      },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: Array<{ key: keyof AttendanceSettings; label: string; hint: string; unit: string }> = [
  {
    key: "presentThreshold",
    label: "Seuil « Présent »",
    hint: "Part de la durée prévue au-delà de laquelle le participant est considéré présent.",
    unit: "%",
  },
  {
    key: "partialThreshold",
    label: "Seuil « Partiellement présent »",
    hint: "En dessous de ce seuil, le participant est considéré absent.",
    unit: "%",
  },
  {
    key: "lateThreshold",
    label: "Retard significatif",
    hint: "Écart après l'heure de début à partir duquel un retard est signalé.",
    unit: "min",
  },
  {
    key: "earlyLeaveThreshold",
    label: "Départ anticipé",
    hint: "Écart avant l'heure de fin à partir duquel un départ anticipé est signalé.",
    unit: "min",
  },
  {
    key: "reconnectionThreshold",
    label: "Connexion instable",
    hint: "Nombre de reconnexions au-delà duquel la connexion est signalée instable.",
    unit: "×",
  },
];

function SettingsPage() {
  const { data, role, organizationId, updateAttendanceSettings, disconnectGoogle } = useAltis();
  const getAuthUrl = useServerFn(getGoogleAuthUrl);
  const [draft, setDraft] = useState<AttendanceSettings>(data.organization.attendanceSettings);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  const readOnly = role !== "ORGANISATION";

  const handleConnectGoogle = async () => {
    if (!organizationId) {
      toast.error("Aucune organisation identifiée.");
      return;
    }
    setConnectingGoogle(true);
    try {
      const res = await getAuthUrl({
        data: {
          organizationId,
          redirectOrigin: window.location.origin,
        },
      });
      window.location.href = res.authUrl;
    } catch (err) {
      setConnectingGoogle(false);
      toast.error(err instanceof Error ? err.message : "Impossible de démarrer la connexion Google.");
    }
  };

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    try {
      await disconnectGoogle();
      toast.success("Compte Google déconnecté");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la déconnexion.");
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Paramètres"
        description="Réglages de l'organisation appliqués à tous les calculs de présence."
      />

      <Panel
        title="Intégration visioconférence"
        description="Google Meet est utilisé pour créer les réunions et récupérer les données de connexion."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              Google Workspace
              <InfoBadge>
                {data.organization.googleConnected ? "Connecté" : "Non connecté"}
              </InfoBadge>
            </p>
            <p className="text-xs text-muted-foreground">
              {data.organization.googleAccount ?? "Aucun compte associé"}
            </p>
          </div>
          <Button
            variant={data.organization.googleConnected ? "outline" : "default"}
            disabled={readOnly || connectingGoogle || disconnectingGoogle}
            onClick={
              data.organization.googleConnected
                ? () => void handleDisconnectGoogle()
                : () => void handleConnectGoogle()
            }
          >
            {connectingGoogle
              ? "Redirection Google…"
              : disconnectingGoogle
                ? "Déconnexion…"
                : data.organization.googleConnected
                  ? "Déconnecter"
                  : "Connecter Google"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Seuils de présence"
        description="Ces seuils déterminent les statuts calculés à partir des données brutes de connexion."
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>
                {field.label} ({field.unit})
              </Label>
              <Input
                id={field.key}
                type="number"
                min={0}
                disabled={readOnly}
                value={draft[field.key]}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button
            variant="ghost"
            disabled={readOnly}
            onClick={() => setDraft(DEFAULT_ATTENDANCE_SETTINGS)}
          >
            Valeurs par défaut
          </Button>
          <Button
            disabled={readOnly}
            onClick={async () => {
              if (draft.partialThreshold >= draft.presentThreshold) {
                toast.error("Le seuil « Partiellement présent » doit être inférieur au seuil « Présent ».");
                return;
              }
              try {
                await updateAttendanceSettings(draft);
                toast.success("Seuils mis à jour - les statuts sont recalculés.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
              }
            }}
          >
            Enregistrer
          </Button>
        </div>
        {readOnly && (
          <p className="px-4 pb-4 text-xs text-muted-foreground">
            Seul le rôle Organisation peut modifier ces réglages.
          </p>
        )}
      </Panel>
    </AppShell>
  );
}