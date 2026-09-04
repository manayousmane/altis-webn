import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation, getInvitation } from "@/lib/altis/invitations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import altisAMark from "@/assets/altis-a-mark.png.asset.json";
import altisWordmark from "@/assets/altis-wordmark.png.asset.json";

interface InviteSearch {
  token?: string | undefined;
}

export const Route = createFileRoute("/invitation")({
  validateSearch: (search: Record<string, unknown>): InviteSearch => ({
    token: typeof search['token'] === "string" ? search['token'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Activer mon accès - ALTIS" },
      {
        name: "description",
        content: "Activez votre accès ALTIS et retrouvez vos sessions de formation en ligne.",
      },
      { property: "og:title", content: "Activer mon accès - ALTIS" },
      { property: "og:description", content: "Invitation à rejoindre un espace ALTIS." },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const fetchInvitation = useServerFn(getInvitation);
  const accept = useServerFn(acceptInvitation);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitation({ data: { token: token! } }),
    enabled: !!token,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setError("Choisissez un mot de passe de 8 caractères minimum.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await accept({ data: { token, password } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (signInError) throw signInError;
      toast.success("Accès activé");
      void navigate({ to: "/tableau-de-bord", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  };

  const invite = invitation.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src={altisAMark.url} alt="" className="h-10 w-auto object-contain" aria-hidden />
          <img src={altisWordmark.url} alt="ALTIS" className="h-5 w-auto object-contain" />
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          {!token ? (
            <p className="text-sm text-muted-foreground">
              Lien d'invitation incomplet. Demandez à votre organisation de vous renvoyer le lien.
            </p>
          ) : invitation.isLoading ? (
            <p className="text-sm text-muted-foreground">Vérification de l'invitation…</p>
          ) : !invite?.found ? (
            <p className="text-sm text-destructive">Cette invitation est introuvable ou expirée.</p>
          ) : invite.activated ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cet accès est déjà activé. Connectez-vous avec votre email.
              </p>
              <Button onClick={() => void navigate({ to: "/auth" })}>Se connecter</Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Bienvenue {invite.firstName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {invite.organizationName} vous invite en tant que{" "}
                  {invite.kind === "FORMATEUR" ? "formateur" : "participant"}. Choisissez votre mot
                  de passe pour activer votre accès.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" value={invite.email} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Mot de passe</Label>
                <Input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                Activer mon accès
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
