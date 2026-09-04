import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarCheck, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import altisAMark from "@/assets/altis-a-mark.png.asset.json";
import altisWordmark from "@/assets/altis-wordmark.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ALTIS - Présence réelle de vos formations en ligne" },
      {
        name: "description",
        content:
          "ALTIS transforme les données de connexion de vos visioconférences en présence réelle, retards et signaux de décrochage, sans extrapolation.",
      },
      { property: "og:title", content: "ALTIS - Présence réelle de vos formations en ligne" },
      {
        property: "og:description",
        content:
          "Programmes, sessions, présence calculée sur des règles claires et seuils configurables.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Programmes et sessions",
    text: "Structurez vos formations en programmes, modules et sessions planifiées avec formateur assigné.",
  },
  {
    icon: Video,
    title: "Réunions en ligne",
    text: "Associez le lien de visioconférence à chaque session et diffusez-le aux participants attendus.",
  },
  {
    icon: BarChart3,
    title: "Présence réelle",
    text: "Durée cumulée, retard, départ anticipé, reconnexions : des indicateurs recalculables à tout moment.",
  },
  {
    icon: ShieldCheck,
    title: "Règles déterministes",
    text: "Aucune prédiction. Des seuils configurables et des signaux factuels, auditable ligne par ligne.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <img src={altisAMark.url} alt="" className="h-9 w-auto object-contain" aria-hidden />
          <img src={altisWordmark.url} alt="ALTIS" className="h-5 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Se connecter</Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Créer un compte
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-8">
        <section className="py-16 text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Pilotage de la présence en formation
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            La présence réelle de vos formations en ligne, sans interprétation
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
            ALTIS conserve les données brutes de connexion de vos sessions et en déduit des
            indicateurs clairs : taux de présence, retards significatifs, départs anticipés et
            participants à surveiller.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Démarrer avec mon organisation
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">J'ai déjà un compte</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-lg border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Trois profils, un seul outil</h2>
          <ul className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <li>
              <span className="font-medium text-foreground">Organisation</span> - crée les
              programmes, invite formateurs et participants, configure les seuils.
            </li>
            <li>
              <span className="font-medium text-foreground">Formateur</span> - suit ses sessions et
              la présence de ses groupes.
            </li>
            <li>
              <span className="font-medium text-foreground">Participant</span> - accède à ses
              sessions et à son historique de présence.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
