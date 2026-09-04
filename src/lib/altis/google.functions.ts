import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createOAuthState, encryptText, verifyOAuthState } from "./crypto.server";
import { GoogleMeetProvider } from "./meeting-provider/google-meet.server";

const SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        redirectOrigin: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID n'est pas configuré sur le serveur.");
    }

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${data.redirectOrigin || "http://localhost:3000"}/google-callback`;

    const state = createOAuthState(data.organizationId);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
      include_granted_scopes: "true",
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  });

export const exchangeGoogleCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1),
        state: z.string().min(1),
        redirectOrigin: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const statePayload = verifyOAuthState(data.state);
    if (!statePayload) {
      return {
        ok: false as const,
        message: "Jeton de sécurité d'autorisation expiré ou invalide. Veuillez réessayer.",
      };
    }

    const { organizationId } = statePayload;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${data.redirectOrigin || "http://localhost:3000"}/google-callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Configuration OAuth serveur incomplète (CLIENT_ID / SECRET manquants).");
    }

    // Échange du code d'autorisation contre les tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        ok: false as const,
        message:
          tokenData.error_description ||
          tokenData.error ||
          "Impossible d'échanger le code d'autorisation auprès de Google.",
      };
    }

    // Récupération de l'email du compte Google connecté
    let accountEmail = "Compte Google Workspace";
    try {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userinfoRes.ok) {
        const userInfo = (await userinfoRes.json()) as { email?: string };
        if (userInfo.email) accountEmail = userInfo.email;
      }
    } catch (e) {
      console.warn("Could not fetch userinfo email", e);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    // Récupération de l'éventuel refresh_token précédent si Google n'en a pas renvoyé un nouveau
    let refreshTokenEncrypted = tokenData.refresh_token ? encryptText(tokenData.refresh_token) : null;
    if (!refreshTokenEncrypted) {
      const { data: prev } = await supabaseAdmin
        .from("organization_google_credentials")
        .select("refresh_token_encrypted")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (prev?.refresh_token_encrypted) {
        refreshTokenEncrypted = prev.refresh_token_encrypted;
      }
    }

    // Enregistrement sécurisé chiffré dans organization_google_credentials
    const { error: credsError } = await supabaseAdmin
      .from("organization_google_credentials")
      .upsert(
        {
          organization_id: organizationId,
          google_account_email: accountEmail,
          access_token_encrypted: encryptText(tokenData.access_token),
          refresh_token_encrypted: refreshTokenEncrypted,
          expires_at: expiresAt,
          scope: tokenData.scope || SCOPES,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );

    if (credsError) {
      throw new Error(`Erreur lors de l'enregistrement des identifiants : ${credsError.message}`);
    }

    // Mise à jour de l'organisation
    await supabaseAdmin
      .from("organizations")
      .update({
        google_connected: true,
        google_account: accountEmail,
      })
      .eq("id", organizationId);

    return {
      ok: true as const,
      email: accountEmail,
    };
  });

export const disconnectGoogleAccount = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tentative de révocation du token auprès de Google si disponible
    try {
      const { data: creds } = await supabaseAdmin
        .from("organization_google_credentials")
        .select("access_token_encrypted, refresh_token_encrypted")
        .eq("organization_id", data.organizationId)
        .maybeSingle();

      if (creds) {
        const { decryptText } = await import("./crypto.server");
        const token = creds.refresh_token_encrypted
          ? decryptText(creds.refresh_token_encrypted)
          : decryptText(creds.access_token_encrypted);

        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }
    } catch (e) {
      console.warn("[OAuth Revoke] Error revoking Google token", e);
    }

    // Suppression des identifiants chiffrés
    await supabaseAdmin
      .from("organization_google_credentials")
      .delete()
      .eq("organization_id", data.organizationId);

    // Mise à jour de l'organisation
    await supabaseAdmin
      .from("organizations")
      .update({
        google_connected: false,
        google_account: null,
      })
      .eq("id", data.organizationId);

    return { ok: true as const };
  });

export const createMeetingForSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().uuid(),
        organizationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    if (error || !session) {
      throw new Error("Session introuvable.");
    }

    try {
      const provider = new GoogleMeetProvider(data.organizationId);
      const result = await provider.createMeeting({
        name: session.name,
        date: session.session_date,
        startTime: session.start_time.slice(0, 5),
        endTime: session.end_time.slice(0, 5),
      });

      await supabaseAdmin
        .from("sessions")
        .update({
          meeting_url: result.joinUrl,
          meeting_code: result.code,
          google_event_id: result.externalMeetingId,
          integration_error: null,
        })
        .eq("id", session.id);

      return {
        ok: true as const,
        joinUrl: result.joinUrl,
        code: result.code,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Échec de création de la réunion Google Meet.";

      await supabaseAdmin
        .from("sessions")
        .update({
          integration_error: errorMessage,
        })
        .eq("id", session.id);

      return {
        ok: false as const,
        error: errorMessage,
      };
    }
  });

export const syncSessionAttendance = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().uuid(),
        organizationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    if (sessionError || !session) {
      throw new Error("Session introuvable.");
    }

    const meetingIdentifier = session.meeting_code || session.meeting_url;
    if (!meetingIdentifier) {
      return {
        ok: false as const,
        error: "Aucun lien de réunion Google Meet n'est associé à cette session.",
      };
    }

    try {
      const provider = new GoogleMeetProvider(data.organizationId);
      const events = await provider.getMeetingAttendance(
        meetingIdentifier,
        session.session_date,
      );

      if (!events || events.length === 0) {
        return {
          ok: false as const,
          empty: true,
          error:
            "Aucun journal de présence Google Meet trouvé pour le moment. Les données de connexion peuvent prendre 2 à 5 minutes après la fin de la réunion pour être finalisées par Google.",
        };
      }

      // Récupération des membres de l'organisation pour faire la correspondance email
      const { data: members } = await supabaseAdmin
        .from("members")
        .select("id, email, kind")
        .eq("organization_id", data.organizationId);

      const memberMap = new Map((members ?? []).map((m) => [m.email.toLowerCase(), m.id]));

      const matchedRows: Array<{
        organization_id: string;
        session_id: string;
        member_id: string;
        joined_at: string;
        left_at: string | null;
        source: string;
      }> = [];

      const matchedMemberIds = new Set<string>();

      for (const ev of events) {
        const memberId = memberMap.get(ev.email.toLowerCase());
        if (memberId) {
          matchedMemberIds.add(memberId);
          matchedRows.push({
            organization_id: data.organizationId,
            session_id: data.sessionId,
            member_id: memberId,
            joined_at: ev.joinedAt,
            left_at: ev.leftAt,
            source: "GOOGLE_MEET",
          });
        }
      }

      if (matchedRows.length === 0) {
        return {
          ok: false as const,
          error: `Google Meet a renvoyé ${events.length} connexion(s), mais aucun email ne correspond aux participants enregistrés dans cette organisation.`,
        };
      }

      // Idempotence : suppression préalable des anciens enregistrements pour cette session
      await supabaseAdmin
        .from("attendance_records")
        .delete()
        .eq("session_id", data.sessionId);

      // Insertion atomique des nouveaux enregistrements
      const { error: insertError } = await supabaseAdmin
        .from("attendance_records")
        .insert(matchedRows);

      if (insertError) {
        throw new Error(`Erreur lors de l'enregistrement des présences : ${insertError.message}`);
      }

      // Mise à jour de la session
      await supabaseAdmin
        .from("sessions")
        .update({
          synced: true,
          synced_at: new Date().toISOString(),
          integration_error: null,
        })
        .eq("id", data.sessionId);

      return {
        ok: true as const,
        recordsCount: matchedRows.length,
        matchedParticipantsCount: matchedMemberIds.size,
        totalEventsCount: events.length,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Erreur lors de la synchronisation avec Google Meet.";
      return {
        ok: false as const,
        error: errorMsg,
      };
    }
  });

