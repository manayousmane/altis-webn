import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAltis } from "@/lib/altis/store";
import type { Role } from "@/lib/altis/types";
import altisAMark from "@/assets/altis-a-mark.png.asset.json";
import altisWordmark from "@/assets/altis-wordmark.png.asset.json";

const NAV = [
  {
    to: "/tableau-de-bord",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    roles: ["ORGANISATION", "FORMATEUR"],
  },
  { to: "/programmes", label: "Programmes", icon: GraduationCap, roles: ["ORGANISATION", "FORMATEUR"] },
  { to: "/formateurs", label: "Formateurs", icon: Users, roles: ["ORGANISATION"] },
  { to: "/participants", label: "Participants", icon: Users, roles: ["ORGANISATION"] },
  { to: "/pilotage", label: "Pilotage", icon: BarChart3, roles: ["ORGANISATION", "FORMATEUR"] },
] as const;

const FOOTER_NAV = [
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["ORGANISATION"] },
] as const;

const ROLE_LABEL: Record<Role, string> = {
  ORGANISATION: "Organisation",
  FORMATEUR: "Formateur",
  PARTICIPANT: "Participant",
};

function AccountMenu() {
  const { userEmail, role, signOut } = useAltis();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-xs font-medium text-foreground">{userEmail ?? "-"}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await signOut();
          void navigate({ to: "/auth", replace: true });
        }}
      >
        <LogOut className="size-4" aria-hidden /> Se déconnecter
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, data } = useAltis();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items =
    role === "PARTICIPANT"
      ? [{ to: "/mes-sessions", label: "Mes sessions", icon: CalendarCheck }]
      : NAV.filter((item) => (item.roles as readonly string[]).includes(role));

  const footerItems =
    role === "PARTICIPANT"
      ? []
      : FOOTER_NAV.filter((item) => (item.roles as readonly string[]).includes(role));

  const navClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex flex-col border-b border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <img
              src={altisAMark.url}
              alt="ALTIS"
              className="h-9 w-auto object-contain"
            />
            <img
              src={altisWordmark.url}
              alt="ALTIS"
              className="h-5 w-auto object-contain"
            />
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
            {items.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={navClass(active)}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          {footerItems.length > 0 && (
            <nav className="flex gap-1 px-2 pb-3 lg:mt-auto lg:flex-col lg:border-t lg:border-sidebar-border lg:pt-3">
              {footerItems.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={navClass(pathname.startsWith(to))}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
            <p className="text-xs text-muted-foreground">
              Pilotage de formations en ligne · Fuseau {data.organization.timezone}
            </p>
            <AccountMenu />
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}