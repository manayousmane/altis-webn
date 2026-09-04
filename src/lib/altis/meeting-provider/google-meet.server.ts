import { decryptText, encryptText } from "../crypto.server";
import type {
  MeetingCreationResult,
  MeetingProvider,
  MeetingSessionInput,
  RawAttendanceEvent,
} from "./types";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleMeetSpaceResponse {
  name: string; // "spaces/abc-defg-hij"
  meetingUri: string; // "https://meet.google.com/abc-defg-hij"
  meetingCode: string; // "abc-defg-hij"
  config?: {
    accessType?: string;
    entryPointAccess?: string;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

interface GoogleCalendarEventResponse {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      meetingCode?: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface ConferenceRecordItem {
  name: string; // "conferenceRecords/xxx"
  startTime: string;
  endTime?: string;
  space?: string;
}

interface ParticipantItem {
  name: string; // "conferenceRecords/xxx/participants/yyy"
  signedinUser?: { user?: string; displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

interface ParticipantSessionItem {
  name: string;
  startTime: string;
  endTime?: string;
}

/**
 * Récupère un access_token valide pour l'organisation.
 * Si le jeton est expiré ou proche de l'expiration (< 5 min),
 * il est automatiquement rafraîchi via le refresh_token chiffré.
 */
export async function getValidGoogleAccessToken(organizationId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: creds, error } = await supabaseAdmin
    .from("organization_google_credentials")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !creds) {
    throw new Error(
      "Aucun compte Google n'est connecté pour cette organisation. Veuillez le connecter dans Paramètres > Intégrations.",
    );
  }

  const expiresAt = new Date(creds.expires_at).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes de marge

  // Si le token est encore valide avec une marge suffisante, on le retourne déchiffré
  if (expiresAt - now > bufferMs) {
    return decryptText(creds.access_token_encrypted);
  }

  // Sinon, rafraîchissement obligatoire
  if (!creds.refresh_token_encrypted) {
    throw new Error(
      "La session Google a expiré et aucun jeton de renouvellement n'est disponible. Veuillez reconnecter votre compte Google.",
    );
  }

  const refreshToken = decryptText(creds.refresh_token_encrypted);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Identifiants Google OAuth serveur manquants (GOOGLE_CLIENT_ID / SECRET).");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  if (!tokenRes.ok || tokenData.error) {
    // Si Google rejette le refresh token (révoqué par l'utilisateur par exemple)
    await supabaseAdmin
      .from("organizations")
      .update({ google_connected: false, google_account: null })
      .eq("id", organizationId);

    await supabaseAdmin
      .from("organization_google_credentials")
      .delete()
      .eq("organization_id", organizationId);

    throw new Error(
      `Connexion Google révoquée ou invalide (${tokenData.error_description || tokenData.error || "Erreur de renouvellement"}). Veuillez reconnecter Google dans Paramètres.`,
    );
  }

  const newAccessToken = tokenData.access_token;
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

  // Mise à jour sécurisée en base
  await supabaseAdmin
    .from("organization_google_credentials")
    .update({
      access_token_encrypted: encryptText(newAccessToken),
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  return newAccessToken;
}

/**
 * Crée un espace de réunion Google Meet via l'API Google Meet REST v2
 * avec repli vers l'API Google Calendar Event (hangoutsMeet).
 */
export async function createGoogleMeet(
  accessToken: string,
  session: MeetingSessionInput,
): Promise<MeetingCreationResult> {
  // 1. Tentative avec l'API Google Meet REST v2 (Spaces API)
  try {
    const meetRes = await fetch("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          accessType: "OPEN",
        },
      }),
    });

    if (meetRes.ok) {
      const space = (await meetRes.json()) as GoogleMeetSpaceResponse;
      if (space.meetingUri) {
        return {
          provider: "GOOGLE_MEET",
          joinUrl: space.meetingUri,
          code: space.meetingCode || space.meetingUri.split("/").pop() || "",
          externalMeetingId: space.name || space.meetingCode,
        };
      }
    }
  } catch (e) {
    console.warn("[GoogleMeetProvider] Spaces API failed, attempting Calendar API fallback", e);
  }

  // 2. Repli vers Google Calendar API avec conferenceData (si l'API Spaces n'est pas activée)
  const startIso = `${session.date}T${session.startTime}:00`;
  const endIso = `${session.date}T${session.endTime}:00`;
  const requestId = `altis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const calRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: session.name,
        description: "Session de formation organisée via ALTIS",
        start: { dateTime: new Date(startIso).toISOString() },
        end: { dateTime: new Date(endIso).toISOString() },
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );

  const calData = (await calRes.json()) as GoogleCalendarEventResponse;

  if (!calRes.ok || calData.error) {
    const message =
      calData.error?.message ||
      "Échec de création de la réunion Google Meet. Vérifiez que l'API Google Meet ou Google Calendar est bien activée dans Google Cloud Console.";
    throw new Error(message);
  }

  const meetUri =
    calData.hangoutLink ||
    calData.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ||
    calData.conferenceData?.entryPoints?.[0]?.uri;

  if (!meetUri) {
    throw new Error("L'API Google n'a pas retourné de lien Google Meet.");
  }

  const code =
    calData.conferenceData?.entryPoints?.[0]?.meetingCode ||
    meetUri.split("/").pop() ||
    calData.id;

  return {
    provider: "GOOGLE_MEET",
    joinUrl: meetUri,
    code,
    externalMeetingId: calData.id,
  };
}

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/**
 * Récupère les données brutes de présence depuis l'API Google Meet (Conference Records & Participant Sessions).
 */
export async function getGoogleMeetAttendance(
  accessToken: string,
  meetingCodeOrId: string,
  sessionDate: string,
): Promise<RawAttendanceEvent[]> {
  const cleanCode = meetingCodeOrId.replace(/^https?:\/\/meet\.google\.com\//, "").trim();

  // 1. Recherche des enregistrements de conférence
  const confRes = await fetch("https://meet.googleapis.com/v2/conferenceRecords", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!confRes.ok) {
    const err = await confRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        "Impossible d'interroger les enregistrements de conférence Google Meet. Assurez-vous que l'API Google Meet est activée.",
    );
  }

  const confData = (await confRes.json()) as { conferenceRecords?: ConferenceRecordItem[] };
  const records = confData.conferenceRecords ?? [];

  // Filtrage du record correspondant au code ou à la date
  const matchedRecord =
    records.find(
      (r) =>
        (r.space && r.space.includes(cleanCode)) ||
        (r.startTime && r.startTime.startsWith(sessionDate)),
    ) || records[0];

  if (!matchedRecord) {
    return [];
  }

  // 2. Récupération des participants de cette conférence
  const partRes = await fetch(`https://meet.googleapis.com/v2/${matchedRecord.name}/participants`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!partRes.ok) return [];

  const partData = (await partRes.json()) as { participants?: ParticipantItem[] };
  const participants = partData.participants ?? [];

  const events: RawAttendanceEvent[] = [];

  // 3. Récupération des sessions pour chaque participant
  for (const participant of participants) {
    const rawEmail =
      participant.signedinUser?.user?.replace(/^users\//, "") ||
      participant.signedinUser?.displayName ||
      participant.anonymousUser?.displayName ||
      "";

    const extractedEmail = EMAIL_REGEX.exec(rawEmail)?.[0]?.toLowerCase();
    if (!extractedEmail) continue;

    const sessRes = await fetch(`https://meet.googleapis.com/v2/${participant.name}/participantSessions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!sessRes.ok) continue;

    const sessData = (await sessRes.json()) as { participantSessions?: ParticipantSessionItem[] };
    const sessions = sessData.participantSessions ?? [];

    for (const s of sessions) {
      if (s.startTime) {
        events.push({
          email: extractedEmail,
          displayName:
            participant.signedinUser?.displayName ||
            participant.anonymousUser?.displayName ||
            undefined,
          joinedAt: s.startTime,
          leftAt: s.endTime ?? null,
        });
      }
    }
  }

  return events;
}

/**
 * Fournisseur concret Google Meet implémentant l'interface MeetingProvider (Section 14.1).
 */
export class GoogleMeetProvider implements MeetingProvider {
  constructor(private organizationId: string) {}

  async createMeeting(session: MeetingSessionInput): Promise<MeetingCreationResult> {
    const accessToken = await getValidGoogleAccessToken(this.organizationId);
    return await createGoogleMeet(accessToken, session);
  }

  async getMeetingAttendance(meetingCodeOrId: string, sessionDate: string): Promise<RawAttendanceEvent[]> {
    const accessToken = await getValidGoogleAccessToken(this.organizationId);
    return await getGoogleMeetAttendance(accessToken, meetingCodeOrId, sessionDate);
  }
}

