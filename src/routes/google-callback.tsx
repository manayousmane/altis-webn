import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exchangeGoogleCode } from "@/lib/altis/google.functions";
import altisAMark from "@/assets/altis-a-mark.png.asset.json";
import altisWordmark from "@/assets/altis-wordmark.png.asset.json";

interface CallbackSearch {
  code?: string | undefined;
  state?: string | undefined;
  error?: string | undefined;
  error_description?: string | undefined;
}

export const Route = createFileRoute("/google-callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    error_description:
      typeof search["error_description"] === "string"
        ? search["error_description"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion Google - ALTIS" },
      { name: "description", content: "Finalisation de la connexion Google Workspace ALTIS." },
    ],
  }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const { code, state, error, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const exchange = useServerFn(exchangeGoogleCode);
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    error ? "error" : "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error ? (error_description || error) : null,
  );

  useEffect(() => {
    if (error) return;
    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Paramètres d'autorisation manquants dans la réponse de Google.");
      return;
    }

    let isMounted = true;

    async function processCode() {
      try {
        const res = await exchange({
          data: {
            code: code!,
            state: state!,
            redirectOrigin: window.location.origin,
          },
        });

        if (!isMounted) return;

        if (res.ok) {
          setStatus("success");
          toast.success(`Compte Google connecté avec succès (${res.email})`);
          void navigate({ to: "/parametres", replace: true });
        } else {
          setStatus("error");
          setErrorMessage(res.message);
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Une erreur inattendue est survenue lors de l'échange avec Google.",
        );
      }
    }

    void processCode();

    return () => {
      isMounted = false;
    };
  }, [code, state, error, error_description, exchange, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src={altisAMark.url} alt="" className="h-10 w-auto object-contain" aria-hidden />
          <img src={altisWordmark.url} alt="ALTIS" className="h-5 w-auto object-contain" />
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-center">
          {status === "processing" && (
            <div className="space-y-3">
              <div className="mx-auto size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h1 className="text-lg font-semibold text-foreground">Connexion à Google en cours…</h1>
              <p className="text-sm text-muted-foreground">
                Nous vérifions vos autorisations et configurons l'intégration Google Meet.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                ✓
              </div>
              <h1 className="text-lg font-semibold text-foreground">Google connecté avec succès</h1>
              <p className="text-sm text-muted-foreground">Redirection vers les paramètres…</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                !
              </div>
              <h1 className="text-lg font-semibold text-foreground">Échec de la connexion Google</h1>
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button asChild className="w-full">
                <Link to="/parametres">Retourner aux Paramètres</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
