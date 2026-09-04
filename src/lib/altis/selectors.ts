import {
  averagePresence,
  computeParticipantInsight,
  computeSessionReport,
  isCompleted,
  sessionStatus,
  toDateTime,
} from "./presence";
import type { AltisData, TrainingSession } from "./types";

export function sortByDate(sessions: TrainingSession[], direction: "asc" | "desc" = "asc") {
  return [...sessions].sort((a, b) => {
    const diff =
      toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

export function programModules(data: AltisData, programId: string) {
  return data.modules
    .filter((m) => m.programId === programId)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function moduleSessions(data: AltisData, moduleId: string) {
  return sortByDate(data.sessions.filter((s) => s.moduleId === moduleId));
}

export function programSessions(data: AltisData, programId: string) {
  const moduleIds = new Set(programModules(data, programId).map((m) => m.id));
  return sortByDate(data.sessions.filter((s) => moduleIds.has(s.moduleId)));
}

export function sessionProgram(data: AltisData, session: TrainingSession) {
  const mod = data.modules.find((m) => m.id === session.moduleId);
  const program = mod ? data.programs.find((p) => p.id === mod.programId) : undefined;
  return { module: mod, program };
}

export function trainerName(data: AltisData, trainerId: string) {
  const t = data.trainers.find((x) => x.id === trainerId);
  return t ? `${t.firstName} ${t.lastName}` : "-";
}

export function participantName(data: AltisData, participantId: string) {
  const p = data.participants.find((x) => x.id === participantId);
  return p ? `${p.firstName} ${p.lastName}` : "-";
}

export function participantPrograms(data: AltisData, participantId: string) {
  return data.programs.filter((p) => p.participantIds.includes(participantId));
}

export function trainerSessions(data: AltisData, trainerId: string) {
  return sortByDate(
    data.sessions.filter((s) => s.trainerId === trainerId),
    "desc",
  );
}

export function upcomingSessions(data: AltisData, limit = 5, now = new Date()) {
  return sortByDate(
    data.sessions.filter(
      (s) => !s.cancelled && toDateTime(s.date, s.endTime).getTime() >= now.getTime(),
    ),
  ).slice(0, limit);
}

export function recentCompletedSessions(data: AltisData, limit = 5, now = new Date()) {
  return sortByDate(
    data.sessions.filter((s) => isCompleted(s, now)),
    "desc",
  ).slice(0, limit);
}

export function participantsToWatch(data: AltisData, scope?: TrainingSession[]) {
  const sessions = scope ?? data.sessions;
  return data.participants
    .map((p) =>
      computeParticipantInsight(p.id, sessions, data.organization.attendanceSettings),
    )
    .filter((insight) => insight.toWatch);
}

export function presenceTrend(data: AltisData, sessions: TrainingSession[], now = new Date()) {
  return sortByDate(sessions.filter((s) => isCompleted(s, now))).map((s) => ({
    name: s.name,
    date: s.date,
    taux: Math.round(computeSessionReport(s, data.organization.attendanceSettings).globalRate),
  }));
}

export function scopeAveragePresence(data: AltisData, sessions: TrainingSession[]) {
  return averagePresence(sessions, data.organization.attendanceSettings);
}

export function liveSessionStatus(session: TrainingSession) {
  return sessionStatus(session);
}

export function formatDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
}

export function formatTime(value: Date | null) {
  if (!value) return "-";
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits).replace(".", ",")} %`;
}