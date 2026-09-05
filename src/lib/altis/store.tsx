import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_DATA, mapRows, type RawAltisRows } from "./db";
import type {
  AltisData,
  AttendanceSettings,
  Module,
  Participant,
  Program,
  Role,
  Trainer,
  TrainingSession,
} from "./types";
import {
  createMeetingForSession,
  disconnectGoogleAccount,
  syncSessionAttendance,
} from "./google.functions";

export interface NewProgramInput {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface NewModuleInput {
  programId: string;
  name: string;
  description?: string;
  order?: number;
}

export interface NewSessionInput {
  moduleId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  trainerId: string;
  meetingUrl?: string;
  createMeetAutomatically?: boolean;
}

export interface NewMemberInput {
  kind: "FORMATEUR" | "PARTICIPANT";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface AttendanceInput {
  participantId: string;
  joinedAt: string;
  leftAt: string | null;
}

interface AltisContextValue {
  data: AltisData;
  isLoading: boolean;
  hasSession: boolean;
  userEmail: string | null;
  organizationId: string | null;
  role: Role;
  isOrgAdmin: boolean;
  currentTrainerId: string;
  currentParticipantId: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  createProgram: (input: NewProgramInput) => Promise<Program>;
  archiveProgram: (programId: string) => Promise<void>;
  createModule: (input: NewModuleInput) => Promise<Module>;
  createSession: (input: NewSessionInput) => Promise<TrainingSession>;
  setSessionMeeting: (sessionId: string, url: string) => Promise<void>;
  generateSessionMeeting: (sessionId: string) => Promise<void>;
  syncSession: (sessionId: string) => Promise<{ recordsCount: number; matchedParticipantsCount: number }>;
  cancelSession: (sessionId: string) => Promise<void>;
  importAttendance: (sessionId: string, rows: AttendanceInput[]) => Promise<void>;
  addParticipantsToSession: (sessionId: string, participantIds: string[]) => Promise<void>;
  setProgramParticipants: (programId: string, participantIds: string[]) => Promise<void>;
  createMember: (input: NewMemberInput) => Promise<Trainer & Participant>;
  deleteMember: (memberId: string) => Promise<void>;
  updateAttendanceSettings: (settings: AttendanceSettings) => Promise<void>;
  setGoogleConnected: (connected: boolean) => Promise<void>;
  disconnectGoogle: () => Promise<void>;
}

const AltisContext = createContext<AltisContextValue | null>(null);

const check = <T,>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

/** Variante pour les requêtes qui doivent renvoyer une ligne. */
function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) {
    throw new Error("Aucune donnée retournée par la base.");
  }
  return result.data as NonNullable<T>;
}

interface Bootstrap {
  organizationId: string | null;
  role: Role;
  trainerId: string;
  participantId: string;
}

async function fetchBootstrap(userId: string): Promise<Bootstrap> {
  const [profile, roles, member] = await Promise.all([
    supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("members").select("id, kind").eq("user_id", userId).maybeSingle(),
  ]);

  const roleRows = check(roles) ?? [];
  const memberRow = check(member);
  const role: Role =
    roleRows.find((r) => r.role === "ORGANISATION")
      ? "ORGANISATION"
      : roleRows.find((r) => r.role === "FORMATEUR")
        ? "FORMATEUR"
        : roleRows[0]?.role === "PARTICIPANT"
          ? "PARTICIPANT"
          : memberRow?.kind === "FORMATEUR"
            ? "FORMATEUR"
            : "PARTICIPANT";

  return {
    organizationId: check(profile)?.organization_id ?? null,
    role,
    trainerId: memberRow?.kind === "FORMATEUR" ? memberRow.id : "",
    participantId: memberRow?.kind === "PARTICIPANT" ? memberRow.id : "",
  };
}

async function fetchAltisData(): Promise<AltisData> {
  const [
    organizations,
    programs,
    programParticipants,
    modules,
    sessions,
    sessionParticipants,
    members,
    attendance,
  ] = await Promise.all([
    supabase.from("organizations").select("*").limit(1),
    supabase.from("programs").select("*"),
    supabase.from("program_participants").select("*"),
    supabase.from("modules").select("*"),
    supabase.from("sessions").select("*"),
    supabase.from("session_participants").select("*"),
    supabase.from("members").select("*").order("last_name"),
    supabase.from("attendance_records").select("*"),
  ]);

  const raw: RawAltisRows = {
    organization: check(organizations)?.[0] ?? null,
    programs: check(programs) ?? [],
    programParticipants: check(programParticipants) ?? [],
    modules: check(modules) ?? [],
    sessions: check(sessions) ?? [],
    sessionParticipants: check(sessionParticipants) ?? [],
    members: check(members) ?? [],
    attendance: check(attendance) ?? [],
  };

  return mapRows(raw);
}

export function AltisProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  const userId = session?.user.id ?? null;

  const bootstrapQuery = useQuery({
    queryKey: ["altis", "bootstrap", userId],
    queryFn: () => fetchBootstrap(userId!),
    enabled: !!userId,
  });

  const organizationId = bootstrapQuery.data?.organizationId ?? null;

  const dataQuery = useQuery({
    queryKey: ["altis", "data", organizationId],
    queryFn: fetchAltisData,
    enabled: !!userId && !!organizationId,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["altis"] });
  }, [queryClient]);

  const data = dataQuery.data ?? EMPTY_DATA;
  const orgId = organizationId ?? "";

  const value = useMemo<AltisContextValue>(() => {
    const requireOrg = () => {
      if (!orgId) throw new Error("Aucune organisation associée à ce compte.");
      return orgId;
    };

    return {
      data,
      isLoading: !sessionReady || bootstrapQuery.isLoading || dataQuery.isLoading,
      hasSession: !!session,
      userEmail: session?.user.email ?? null,
      organizationId,
      role: bootstrapQuery.data?.role ?? "PARTICIPANT",
      isOrgAdmin: bootstrapQuery.data?.role === "ORGANISATION",
      currentTrainerId: bootstrapQuery.data?.trainerId ?? "",
      currentParticipantId: bootstrapQuery.data?.participantId ?? "",
      refresh,
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
      createProgram: async (input) => {
        const row = must(
          await supabase
            .from("programs")
            .insert({
              organization_id: requireOrg(),
              name: input.name.trim(),
              description: input.description?.trim() || null,
              start_date: input.startDate || null,
              end_date: input.endDate || null,
            })
            .select()
            .single(),
        );
        await refresh();
        return {
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          startDate: row.start_date ?? undefined,
          endDate: row.end_date ?? undefined,
          archived: row.archived,
          participantIds: [],
        };
      },
      archiveProgram: async (programId) => {
        check(await supabase.from("programs").update({ archived: true }).eq("id", programId));
        await refresh();
      },
      createModule: async (input) => {
        const siblings = data.modules.filter((m) => m.programId === input.programId);
        const row = must(
          await supabase
            .from("modules")
            .insert({
              organization_id: requireOrg(),
              program_id: input.programId,
              name: input.name.trim(),
              description: input.description?.trim() || null,
              position: input.order ?? siblings.length + 1,
            })
            .select()
            .single(),
        );
        await refresh();
        return {
          id: row.id,
          programId: row.program_id,
          name: row.name,
          description: row.description ?? undefined,
          order: row.position,
          createdAt: row.created_at,
        };
      },
      createSession: async (input) => {
        const organization_id = requireOrg();
        const mod = data.modules.find((m) => m.id === input.moduleId);
        const program = data.programs.find((p) => p.id === mod?.programId);
        const trainer = must(
          await supabase
            .from("members")
            .select("id")
            .eq("id", input.trainerId)
            .eq("organization_id", organization_id)
            .eq("kind", "FORMATEUR")
            .maybeSingle(),
        );
        const meetingUrl = input.meetingUrl?.trim() || null;
        const autoMeet =
          input.createMeetAutomatically !== undefined
            ? input.createMeetAutomatically
            : data.organization.googleConnected;

        const row = must(
          await supabase
            .from("sessions")
            .insert({
              organization_id,
              module_id: input.moduleId,
              name: input.name.trim(),
              session_date: input.date,
              start_time: input.startTime,
              end_time: input.endTime,
              trainer_id: trainer.id,
              meeting_url: meetingUrl,
              meeting_code: meetingUrl ? (meetingUrl.split("/").pop() ?? null) : null,
              integration_error: meetingUrl
                ? null
                : autoMeet && !data.organization.googleConnected
                  ? "Connectez votre compte Google dans Paramètres > Intégrations pour activer la création automatique de réunion."
                  : null,
            })
            .select()
            .single(),
        );

        const participantIds = program?.participantIds ?? [];
        if (participantIds.length > 0) {
          check(
            await supabase.from("session_participants").insert(
              participantIds.map((member_id) => ({
                organization_id,
                session_id: row.id,
                member_id,
              })),
            ),
          );
        }

        // Si l'option Meet automatique est activée et que Google est connecté
        let finalMeetingUrl = meetingUrl;
        let finalMeetingCode = meetingUrl ? (meetingUrl.split("/").pop() ?? null) : null;
        let integrationError: string | undefined = row.integration_error ?? undefined;

        if (autoMeet && !meetingUrl && data.organization.googleConnected) {
          try {
            const meetRes = await createMeetingForSession({
              data: {
                sessionId: row.id,
                organizationId: organization_id,
              },
            });
            if (meetRes.ok) {
              finalMeetingUrl = meetRes.joinUrl;
              finalMeetingCode = meetRes.code;
              integrationError = undefined;
            } else {
              integrationError = meetRes.error;
            }
          } catch (err) {
            integrationError =
              err instanceof Error ? err.message : "Échec de génération Google Meet.";
          }
        }

        await refresh();
        return {
          id: row.id,
          moduleId: row.module_id,
          name: row.name,
          date: row.session_date,
          startTime: row.start_time.slice(0, 5),
          endTime: row.end_time.slice(0, 5),
          trainerId: row.trainer_id ?? "",
          participantIds,
          cancelled: row.cancelled,
          integrationError,
          meeting: finalMeetingUrl
            ? {
                sessionId: row.id,
                provider: "GOOGLE_MEET",
                url: finalMeetingUrl,
                code: finalMeetingCode ?? "",
              }
            : undefined,
          synced: row.synced,
          attendance: [],
        };
      },
      setSessionMeeting: async (sessionId, url) => {
        const clean = url.trim();
        check(
          await supabase
            .from("sessions")
            .update({
              meeting_url: clean,
              meeting_code: clean.split("/").pop() ?? null,
              integration_error: null,
            })
            .eq("id", sessionId),
        );
        await refresh();
      },
      generateSessionMeeting: async (sessionId) => {
        const organization_id = requireOrg();
        const res = await createMeetingForSession({
          data: {
            sessionId,
            organizationId: organization_id,
          },
        });
        await refresh();
        if (!res.ok) {
          throw new Error(res.error);
        }
      },
      syncSession: async (sessionId) => {
        const organization_id = requireOrg();
        const res = await syncSessionAttendance({
          data: {
            sessionId,
            organizationId: organization_id,
          },
        });
        await refresh();
        if (!res.ok) {
          throw new Error(res.error);
        }
        return {
          recordsCount: res.recordsCount,
          matchedParticipantsCount: res.matchedParticipantsCount,
        };
      },
      cancelSession: async (sessionId) => {
        check(await supabase.from("sessions").update({ cancelled: true }).eq("id", sessionId));
        await refresh();
      },
      importAttendance: async (sessionId, rows) => {
        const organization_id = requireOrg();
        check(await supabase.from("attendance_records").delete().eq("session_id", sessionId));
        if (rows.length > 0) {
          check(
            await supabase.from("attendance_records").insert(
              rows.map((r) => ({
                organization_id,
                session_id: sessionId,
                member_id: r.participantId,
                joined_at: r.joinedAt,
                left_at: r.leftAt,
              })),
            ),
          );
        }
        check(
          await supabase
            .from("sessions")
            .update({ synced: true, synced_at: new Date().toISOString() })
            .eq("id", sessionId),
        );
        await refresh();
      },
      addParticipantsToSession: async (sessionId, participantIds) => {
        const organization_id = requireOrg();
        const existing = data.sessions.find((s) => s.id === sessionId)?.participantIds ?? [];
        const toAdd = participantIds.filter((id) => !existing.includes(id));
        if (toAdd.length > 0) {
          check(
            await supabase.from("session_participants").insert(
              toAdd.map((member_id) => ({ organization_id, session_id: sessionId, member_id })),
            ),
          );
        }
        await refresh();
      },
      setProgramParticipants: async (programId, participantIds) => {
        const organization_id = requireOrg();
        check(await supabase.from("program_participants").delete().eq("program_id", programId));
        if (participantIds.length > 0) {
          check(
            await supabase.from("program_participants").insert(
              participantIds.map((member_id) => ({ organization_id, program_id: programId, member_id })),
            ),
          );
        }
        await refresh();
      },
      createMember: async (input) => {
        const row = must(
          await supabase
            .from("members")
            .insert({
              organization_id: requireOrg(),
              kind: input.kind,
              first_name: input.firstName.trim(),
              last_name: input.lastName.trim(),
              email: input.email.trim().toLowerCase(),
              phone: input.phone?.trim() || null,
              invite_token: crypto.randomUUID().replace(/-/g, ""),
              invited_at: new Date().toISOString(),
            })
            .select()
            .single(),
        );
        await refresh();
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
      },
      deleteMember: async (memberId) => {
        check(await supabase.from("members").delete().eq("id", memberId));
        await refresh();
      },
      updateAttendanceSettings: async (settings) => {
        check(
          await supabase
            .from("organizations")
            .update({
              present_threshold: settings.presentThreshold,
              partial_threshold: settings.partialThreshold,
              late_threshold: settings.lateThreshold,
              early_leave_threshold: settings.earlyLeaveThreshold,
              reconnection_threshold: settings.reconnectionThreshold,
            })
            .eq("id", requireOrg()),
        );
        await refresh();
      },
      setGoogleConnected: async (connected) => {
        check(
          await supabase
            .from("organizations")
            .update({
              google_connected: connected,
              google_account: connected ? (session?.user.email ?? null) : null,
            })
            .eq("id", requireOrg()),
        );
        await refresh();
      },
      disconnectGoogle: async () => {
        const organization_id = requireOrg();
        await disconnectGoogleAccount({
          data: { organizationId: organization_id },
        });
        await refresh();
      },
    };
  }, [
    data,
    orgId,
    organizationId,
    session,
    sessionReady,
    bootstrapQuery.data,
    bootstrapQuery.isLoading,
    dataQuery.isLoading,
    queryClient,
    refresh,
  ]);

  return <AltisContext.Provider value={value}>{children}</AltisContext.Provider>;
}

export function useAltis() {
  const ctx = useContext(AltisContext);
  if (!ctx) throw new Error("useAltis doit être utilisé dans un AltisProvider");
  return ctx;
}
