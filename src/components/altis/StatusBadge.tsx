import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESENCE_STATUS_LABEL, SESSION_STATUS_LABEL } from "@/lib/altis/presence";
import type { PresenceStatus, SessionStatus } from "@/lib/altis/types";

const base =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function PresenceBadge({ status }: { status: PresenceStatus }) {
  const tone =
    status === "PRESENT"
      ? "border-success/30 bg-success-soft text-success"
      : status === "PARTIEL"
        ? "border-warning/30 bg-warning-soft text-warning-foreground"
        : "border-destructive/30 bg-destructive-soft text-destructive";
  return <span className={cn(base, tone)}>{PRESENCE_STATUS_LABEL[status]}</span>;
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "TERMINEE"
      ? "border-border bg-muted text-muted-foreground"
      : status === "ERREUR_INTEGRATION"
        ? "border-destructive/30 bg-destructive-soft text-destructive"
        : status === "ANNULEE"
          ? "border-border bg-muted text-muted-foreground line-through"
          : "border-primary/25 bg-primary-soft text-primary";
  return (
    <span className={cn(base, tone)}>
      {status === "ERREUR_INTEGRATION" && <AlertTriangle className="size-3" aria-hidden />}
      {status === "EN_COURS" && (
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      )}
      {SESSION_STATUS_LABEL[status]}
    </span>
  );
}

export function WatchBadge({ toWatch }: { toWatch: boolean }) {
  return (
    <span
      className={cn(
        base,
        toWatch
          ? "border-warning/30 bg-warning-soft text-warning-foreground"
          : "border-success/30 bg-success-soft text-success",
      )}
    >
      {toWatch ? "À surveiller" : "Actif"}
    </span>
  );
}

export function InfoBadge({ children }: { children: React.ReactNode }) {
  return <span className={cn(base, "border-border bg-muted text-muted-foreground")}>{children}</span>;
}