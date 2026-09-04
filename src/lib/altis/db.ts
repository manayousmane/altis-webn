import type { Database } from "@/integrations/supabase/types";
import type {
  AltisData,
  AttendanceRecord,
  Module,
  Organization,
  Participant,
  Program,
  Trainer,
  TrainingSession,
} from "./types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export interface RawAltisRows {
  organization: Row<"organizations"> | null;
  programs: Row<"programs">[];
  programParticipants: Row<"program_participants">[];
  modules: Row<"modules">[];
  sessions: Row<"sessions">[];
  sessionParticipants: Row<"session_participants">[];
  members: Row<"members">[];
  attendance: Row<"attendance_records">[];
}

export const EMPTY_ORGANIZATION: Organization = {
  id: "",
  name: "Mon organisation",
  timezone: "Europe/Paris",
  googleConnected: false,
  attendanceSettings: {
    presentThreshold: 80,
    partialThreshold: 10,
    lateThreshold: 10,
    earlyLeaveThreshold: 10,
    reconnectionThreshold: 3,
  },
};

export const EMPTY_DATA: AltisData = {
  organization: EMPTY_ORGANIZATION,
  programs: [],
  modules: [],
  sessions: [],
  trainers: [],
  participants: [],
};

const hhmm = (value: string) => value.slice(0, 5);

function toMember(row: Row<"members">): Trainer & Participant {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? undefined,
    userId: row.user_id,
    inviteToken: row.invite_token,
    invitedAt: row.invited_at,
    activatedAt: row.activated_at,
  };
}

export function mapRows(raw: RawAltisRows): AltisData {
  const org = raw.organization;
  const organization: Organization = org
    ? {
        id: org.id,
        name: org.name,
        timezone: org.timezone,
        googleConnected: org.google_connected,
        googleAccount: org.google_account ?? undefined,
        attendanceSettings: {
          presentThreshold: org.present_threshold,
          partialThreshold: org.partial_threshold,
          lateThreshold: org.late_threshold,
          earlyLeaveThreshold: org.early_leave_threshold,
          reconnectionThreshold: org.reconnection_threshold,
        },
      }
    : EMPTY_ORGANIZATION;

  const programs: Program[] = raw.programs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    startDate: p.start_date ?? undefined,
    endDate: p.end_date ?? undefined,
    archived: p.archived,
    participantIds: raw.programParticipants
      .filter((pp) => pp.program_id === p.id)
      .map((pp) => pp.member_id),
  }));

  const modules: Module[] = raw.modules.map((m) => ({
    id: m.id,
    programId: m.program_id,
    name: m.name,
    description: m.description ?? undefined,
    order: m.position,
    createdAt: m.created_at,
  }));

  const sessions: TrainingSession[] = raw.sessions.map((s) => {
    const attendance: AttendanceRecord[] = raw.attendance
      .filter((a) => a.session_id === s.id)
      .map((a) => ({
        participantId: a.member_id,
        joinedAt: a.joined_at,
        leftAt: a.left_at,
      }));

    return {
      id: s.id,
      moduleId: s.module_id,
      name: s.name,
      date: s.session_date,
      startTime: hhmm(s.start_time),
      endTime: hhmm(s.end_time),
      trainerId: s.trainer_id ?? "",
      participantIds: raw.sessionParticipants
        .filter((sp) => sp.session_id === s.id)
        .map((sp) => sp.member_id),
      cancelled: s.cancelled,
      integrationError: s.integration_error ?? undefined,
      meeting: s.meeting_url
        ? {
            sessionId: s.id,
            provider: "GOOGLE_MEET",
            url: s.meeting_url,
            code: s.meeting_code ?? s.meeting_url.split("/").pop() ?? "",
          }
        : undefined,
      synced: s.synced,
      attendance,
    };
  });

  return {
    organization,
    programs,
    modules,
    sessions,
    trainers: raw.members.filter((m) => m.kind === "FORMATEUR").map(toMember),
    participants: raw.members.filter((m) => m.kind === "PARTICIPANT").map(toMember),
  };
}
