import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import altisAMark from "@/assets/altis-a-mark.png.asset.json";
import altisWordmark from "@/assets/altis-wordmark.png.asset.json";

interface AuthSearch {
  mode?: "signup" | "signin" | undefined;
  redirect?: string | undefined;
}

const APP_URL = "https://altis-webn.vercel.app";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search['mode'] === "signup" ? "signup" : "signin",
    redirect:
      typeof search['redirect'] === "string" && search['redirect'].startsWith("/")
        ? search['redirect']
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion - ALTIS" },
      {
        name: "description",
        content:
          "Connectez-vous à ALTIS pour piloter la présence réelle de vos sessions de formation en ligne.",
      },
      { property: "og:title", content: "Connexion - ALTIS" },
      {
        property: "og:description",
        content: "Accès à votre espace ALTIS : programmes, sessions et présence.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">(search['mode'] === "signup" ? "signup" : "signin");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null);

  const destination = search.redirect ?? "/tableau-de-bord";

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: destination, replace: true });
    });
  }, [destination, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!form.email.trim() || form.password.length < 8) {
      setMessage("Renseignez un email valide et un mot de passe de 8 caractères minimum.");
      return;
    }
    setPending(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: `${APP_URL}/bienvenue`,
            data: { first_name: form.firstName.trim(), last_name: form.lastName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSignupSuccessEmail(form.email.trim());
          return;
        }
        toast.success("Compte créé");
        void navigate({ to: "/bienvenue", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
        toast.success("Connexion réussie");
        void navigate({ to: destination, replace: true });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${APP_URL}/auth`,
      },
    });
    if (error) {
      setMessage("La connexion Google a échoué. Réessayez ou utilisez votre email.");
    }
  };

  const resetPassword = async () => {
    if (!form.email.trim()) {
      setMessage("Renseignez votre email pour recevoir le lien de réinitialisation.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${APP_URL}/reset-password`,
    });
    if (error) setMessage(error.message);
    else toast.success("Email de réinitialisation envoyé");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <img src={altisAMark.url} alt="" className="h-10 w-auto object-contain" aria-hidden />
          <img src={altisWordmark.url} alt="ALTIS" className="h-5 w-auto object-contain" />
        </Link>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {signupSuccessEmail ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="size-7" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Vérifiez votre boîte mail</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Un email de confirmation a été envoyé à :<br />
                  <strong className="text-foreground">{signupSuccessEmail}</strong>
                </p>
              </div>

              <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                <p className="font-medium text-foreground">📌 Prochaine étape :</p>
                <p className="mt-1">
                  Cliquez sur le lien dans l'email pour activer votre accès et nommer votre organisation.
                </p>
                <p className="mt-1 text-[11px] opacity-80">
                  (Pensez à vérifier vos courriers indésirables / spams si vous ne le voyez pas dans la minute).
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSignupSuccessEmail(null);
                    setMode("signin");
                  }}
                >
                  J'ai déjà validé mon compte / Se connecter
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">
                {mode === "signup" ? "Créer un compte organisation" : "Se connecter"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signup"
                  ? "Votre organisation sera créée à l'étape suivante."
                  : "Formateurs et participants se connectent avec l'accès reçu par invitation."}
              </p>

              <form className="mt-5 space-y-4" onSubmit={submit}>
                {mode === "signup" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                {message && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {message}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={pending}>
                  {mode === "signup" ? "Créer mon compte" : "Se connecter"}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full" onClick={() => void signInWithGoogle()}>
                Continuer avec Google
              </Button>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setMessage(null);
                    setMode(mode === "signup" ? "signin" : "signup");
                  }}
                >
                  {mode === "signup" ? "J'ai déjà un compte" : "Créer un compte organisation"}
                </button>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline"
                    onClick={() => void resetPassword()}
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
