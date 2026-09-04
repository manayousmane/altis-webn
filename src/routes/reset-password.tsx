import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe - ALTIS" },
      { name: "description", content: "Définissez un nouveau mot de passe pour votre compte ALTIS." },
      { property: "og:title", content: "Nouveau mot de passe - ALTIS" },
      { property: "og:description", content: "Réinitialisation sécurisée de votre accès ALTIS." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Mot de passe mis à jour");
    void navigate({ to: "/tableau-de-bord", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <h1 className="text-xl font-semibold text-foreground">Nouveau mot de passe</h1>
        <div className="space-y-2">
          <Label htmlFor="new-password">Mot de passe</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          Enregistrer
        </Button>
      </form>
    </div>
  );
}
