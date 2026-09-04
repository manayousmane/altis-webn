import type {
  AttendanceRecord,
  AttendanceSettings,
  PresenceStatus,
  SessionStatus,
  TrainingSession,
} from "./types";

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  presentThreshold: 80,
  partialThreshold: 10,
  lateThreshold: 10,
  earlyLeaveThreshold: 10,
  reconnectionThreshold: 2,
};

export function toDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/** Durée programmée de la session, en minutes (section 12.3). */
export function scheduledDuration(session: TrainingSession): number {
  const start = toDateTime(session.date, session.startTime).getTime();
  const end = toDateTime(session.date, session.endTime).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function sessionStatus(session: TrainingSession, now = new Date()): SessionStatus {
  if (session.cancelled) return "ANNULEE";
  if (session.integrationError) return "ERREUR_INTEGRATION";
  const start = toDateTime(session.date, session.startTime);
  const end = toDateTime(session.date, session.endTime);
  if (now < start) return "PROGRAMMEE";
  if (now <= end) return "EN_COURS";
  return "TERMINEE";
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  PROGRAMMEE: "Programmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ERREUR_INTEGRATION: "Erreur d'intégration",
  ANNULEE: "Annulée",
};

export const PRESENCE_STATUS_LABEL: Record<PresenceStatus, string> = {
  PRESENT: "Présent",
  PARTIEL: "Partiellement présent",
  ABSENT: "Absent",
};

export interface ParticipantSessionResult {
  participantId: string;
  sessionId: string;
  firstJoin: Date | null;
  lastLeave: Date | null;
  /** Durée cumulée, en minutes (section 12.2). */
  cumulativeMinutes: number;
  /** Taux de présence en % (section 12.3). */
  attendanceRate: number;
  /** Retard réel en minutes (section 12.5). */
  lateMinutes: number;
  /** Départ anticipé réel en minutes (section 12.6). */
  earlyLeaveMinutes: number;
  reconnections: number;
  status: PresenceStatus;
  significantLate: boolean;
  significantEarlyLeave: boolean;
  unstableConnection: boolean;
  /** Donnée potentiellement incomplète (section 12.8). */
  incompleteData: boolean;
}

function presenceStatus(rate: number, settings: AttendanceSettings): PresenceStatus {
  if (rate >= settings.presentThreshold) return "PRESENT";
  if (rate >= settings.partialThreshold) return "PARTIEL";
  return "ABSENT";
}

/**
 * Moteur de présence : dérive les indicateurs ALTIS à partir des données brutes
 * (jamais modifiées) du fournisseur de visioconférence.
 */
export function computeParticipantSession(
  session: TrainingSession,
  participantId: string,
  settings: AttendanceSettings,
): ParticipantSessionResult {
  const scheduledStart = toDateTime(session.date, session.startTime);
  const scheduledEnd = toDateTime(session.date, session.endTime);
  const duration = scheduledDuration(session);

  const records: AttendanceRecord[] = session.attendance
    .filter((r) => r.participantId === participantId)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  let cumulativeMs = 0;
  let incompleteData = false;
  let firstJoin: Date | null = null;
  let lastLeave: Date | null = null;

  for (const record of records) {
    const joined = new Date(record.joinedAt);
    // Donnée manquante : la période reste ouverte jusqu'à la fin programmée au maximum.
    let left: Date;
    if (record.leftAt) {
      left = new Date(record.leftAt);
    } else {
      left = scheduledEnd;
      incompleteData = true;
    }
    if (!firstJoin || joined < firstJoin) firstJoin = joined;
    if (record.leftAt && (!lastLeave || left > lastLeave)) lastLeave = left;
    cumulativeMs += Math.max(0, left.getTime() - joined.getTime());
  }

  const cumulativeMinutes = Math.round(cumulativeMs / 60000);
  const attendanceRate = duration > 0 ? (cumulativeMinutes / duration) * 100 : 0;
  const lateMinutes = firstJoin
    ? Math.max(0, Math.round((firstJoin.getTime() - scheduledStart.getTime()) / 60000))
    : 0;
  const earlyLeaveMinutes = lastLeave
    ? Math.max(0, Math.round((scheduledEnd.getTime() - lastLeave.getTime()) / 60000))
    : 0;
  const reconnections = Math.max(0, records.length - 1);

  return {
    participantId,
    sessionId: session.id,
    firstJoin,
    lastLeave,
    cumulativeMinutes,
    attendanceRate,
    lateMinutes,
    earlyLeaveMinutes,
    reconnections,
    status: presenceStatus(attendanceRate, settings),
    significantLate: lateMinutes >= settings.lateThreshold,
    significantEarlyLeave: earlyLeaveMinutes >= settings.earlyLeaveThreshold,
    unstableConnection: reconnections > settings.reconnectionThreshold,
    incompleteData,
  };
}

export interface SessionReport {
  session: TrainingSession;
  expected: number;
  present: number;
  partial: number;
  absent: number;
  /** Taux de présence global de la session (moyenne des taux participants). */
  globalRate: number;
  rows: ParticipantSessionResult[];
}

export function computeSessionReport(
  session: TrainingSession,
  settings: AttendanceSettings,
): SessionReport {
  const rows = session.participantIds.map((id) =>
    computeParticipantSession(session, id, settings),
  );
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const partial = rows.filter((r) => r.status === "PARTIEL").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const globalRate = rows.length
    ? rows.reduce((sum, r) => sum + Math.min(100, r.attendanceRate), 0) / rows.length
    : 0;

  return { session, expected: rows.length, present, partial, absent, globalRate, rows };
}

/** Une session est "complétée" si terminée ET synchronisée (section 12.12). */
export function isCompleted(session: TrainingSession, now = new Date()): boolean {
  return sessionStatus(session, now) === "TERMINEE" && session.synced;
}

export function progression(sessions: TrainingSession[], now = new Date()): number {
  const planned = sessions.filter((s) => !s.cancelled);
  if (!planned.length) return 0;
  return (planned.filter((s) => isCompleted(s, now)).length / planned.length) * 100;
}

export interface ParticipantInsight {
  participantId: string;
  /** Score de présence (section 12.9). */
  presenceScore: number;
  attended: number;
  missed: number;
  relevantSessions: number;
  /** Historique chronologique des taux de présence. */
  history: { sessionId: string; label: string; rate: number; status: PresenceStatus }[];
  averageRate: number;
  trend: "HAUSSE" | "STABLE" | "BAISSE";
  /** Signaux de décrochage (section 12.11) - règles transparentes. */
  signals: string[];
  toWatch: boolean;
}

export function computeParticipantInsight(
  participantId: string,
  sessions: TrainingSession[],
  settings: AttendanceSettings,
  now = new Date(),
): ParticipantInsight {
  const relevant = sessions
    .filter((s) => s.participantIds.includes(participantId) && isCompleted(s, now))
    .sort(
      (a, b) =>
        toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime(),
    );

  const results = relevant.map((s) => computeParticipantSession(s, participantId, settings));
  const history = results.map((r, i) => ({
    sessionId: relevant[i]!.id,
    label: relevant[i]!.name,
    rate: Math.round(Math.min(100, r.attendanceRate)),
    status: r.status,
  }));

  const attended = results.filter((r) => r.status === "PRESENT").length;
  const missed = results.filter((r) => r.status === "ABSENT").length;
  const presenceScore = results.length ? (attended / results.length) * 100 : 0;
  const averageRate = history.length
    ? history.reduce((s, h) => s + h.rate, 0) / history.length
    : 0;

  const last = history.slice(-3);
  let trend: ParticipantInsight["trend"] = "STABLE";
  if (last.length >= 2) {
    const delta = last[last.length - 1]!.rate - last[0]!.rate;
    if (delta <= -10) trend = "BAISSE";
    else if (delta >= 10) trend = "HAUSSE";
  }

  const signals: string[] = [];
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1]!.rate - history[i]!.rate > 20) {
      signals.push(
        `Baisse de ${history[i - 1]!.rate - history[i]!.rate} points entre deux sessions consécutives`,
      );
      break;
    }
  }
  const lastFour = results.slice(-4);
  const absencesInLastFour = lastFour.filter((r) => r.status === "ABSENT").length;
  if (absencesInLastFour >= 2) {
    signals.push(`${absencesInLastFour} absences sur les ${lastFour.length} dernières sessions`);
  }
  if (history.length >= 3) {
    const tail = history.slice(-3);
    const a = tail[0]!.rate;
    const b = tail[1]!.rate;
    const c = tail[2]!.rate;
    if (a > b && b > c) {
      signals.push("Tendance continue à la baisse sur 3 sessions consécutives");
    }
  }
  const lateCount = results.filter((r) => r.significantLate).length;
  if (lateCount >= 3) signals.push(`${lateCount} retards significatifs enregistrés`);

  return {
    participantId,
    presenceScore,
    attended,
    missed,
    relevantSessions: results.length,
    history,
    averageRate,
    trend,
    signals,
    toWatch: signals.length > 0,
  };
}

/** Taux de présence moyen sur un ensemble de sessions synchronisées. */
export function averagePresence(
  sessions: TrainingSession[],
  settings: AttendanceSettings,
  now = new Date(),
): number {
  const done = sessions.filter((s) => isCompleted(s, now));
  if (!done.length) return 0;
  return (
    done.reduce((sum, s) => sum + computeSessionReport(s, settings).globalRate, 0) / done.length
  );
}