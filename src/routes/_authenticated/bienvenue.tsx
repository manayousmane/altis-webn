import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAltis } from "@/lib/altis/store";
import { getGoogleAuthUrl } from "@/lib/altis/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIMEZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Africa/Abidjan",
  "Africa/Dakar",
  "Africa/Douala",
  "America/Montreal",
];

export const Route = createFileRoute("/_authenticated/bienvenue")({
  head: () => ({
    meta: [
      { title: "Créer mon organisation - ALTIS" },
      {
        name: "description",
        content: "Première étape ALTIS : nommez votre organisation et choisissez son fuseau horaire.",
      },
      { property: "og:title", content: "Créer mon organisation - ALTIS" },
      { property: "og:description", content: "Configuration initiale de votre espace ALTIS." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const { organizationId, refresh } = useAltis();
  const getAuthUrl = useServerFn(getGoogleAuthUrl);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) void navigate({ to: "/tableau-de-bord", replace: true });
  }, [organizationId, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Le nom de l'organisation est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    const { data: createdOrganizationId, error: rpcError } = await supabase.rpc("create_organization", {
      _name: name.trim(),
      _timezone: timezone,
    });
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await refresh();
    toast.success("Organisation créée");
    try {
      const { authUrl } = await getAuthUrl({
        data: {
          organizationId: createdOrganizationId,
          redirectOrigin: window.location.origin,
        },
      });
      window.location.assign(authUrl);
    } catch {
      void navigate({ to: "/tableau-de-bord", replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground">Créer mon organisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            C'est le périmètre de vos programmes, formateurs et participants.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'organisation</Label>
          <Input
            id="org-name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-tz">Fuseau horaire</Label>
          <select
            id="org-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          Créer mon organisation
        </Button>
      </form>
    </div>
  );
}
