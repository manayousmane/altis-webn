export type Role = "ORGANISATION" | "FORMATEUR" | "PARTICIPANT";

export type SessionStatus =
  | "PROGRAMMEE"
  | "EN_COURS"
  | "TERMINEE"
  | "ERREUR_INTEGRATION"
  | "ANNULEE";

export type PresenceStatus = "PRESENT" | "PARTIEL" | "ABSENT";

export interface AttendanceSettings {
  /** Seuil (%) au-dessus duquel le participant est "Présent". */
  presentThreshold: number;
  /** Seuil (%) au-dessus duquel le participant est "Partiellement présent". */
  partialThreshold: number;
  /** Seuil (min) de signalement d'un retard significatif. */
  lateThreshold: number;
  /** Seuil (min) de signalement d'un départ anticipé. */
  earlyLeaveThreshold: number;
  /** Nombre de reconnexions au-delà duquel on signale "connexion instable". */
  reconnectionThreshold: number;
}

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  googleConnected: boolean;
  googleAccount?: string | undefined;
  attendanceSettings: AttendanceSettings;
}

export interface Program {
  id: string;
  name: string;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  archived?: boolean | undefined;
  participantIds: string[];
}

export interface Module {
  id: string;
  programId: string;
  name: string;
  description?: string | undefined;
  order: number;
  createdAt: string;
}

export interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  userId?: string | null | undefined;
  inviteToken?: string | null | undefined;
  invitedAt?: string | null | undefined;
  activatedAt?: string | null | undefined;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  userId?: string | null | undefined;
  inviteToken?: string | null | undefined;
  invitedAt?: string | null | undefined;
  activatedAt?: string | null | undefined;
}

export interface Meeting {
  sessionId: string;
  provider: "GOOGLE_MEET";
  url: string;
  code: string;
}

/** Donnée brute telle que renvoyée par le fournisseur de visioconférence. */
export interface AttendanceRecord {
  participantId: string;
  /** ISO datetime de connexion. */
  joinedAt: string;
  /** ISO datetime de déconnexion - null si la donnée est incomplète. */
  leftAt: string | null;
}

export interface TrainingSession {
  id: string;
  moduleId: string;
  name: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  trainerId: string;
  participantIds: string[];
  cancelled?: boolean | undefined;
  integrationError?: string | undefined;
  meeting?: Meeting | undefined;
  synced: boolean;
  attendance: AttendanceRecord[];
}

export interface AltisData {
  organization: Organization;
  programs: Program[];
  modules: Module[];
  sessions: TrainingSession[];
  trainers: Trainer[];
  participants: Participant[];
}