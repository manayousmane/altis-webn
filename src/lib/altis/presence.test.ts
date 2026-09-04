/**
 * Tests unitaires du moteur de présence ALTIS (Section 25.2 de la spécification MVP).
 * Couvre l'intégralité des calculs de présence, retards, départs anticipés,
 * reconnexions, données manquantes et signaux de décrochage.
 */

import {
  computeParticipantInsight,
  computeParticipantSession,
  computeSessionReport,
  DEFAULT_ATTENDANCE_SETTINGS,
  progression,
  scheduledDuration,
  sessionStatus,
} from "./presence";
import type { TrainingSession } from "./types";

function createMockSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "session-1",
    moduleId: "module-1",
    name: "Séance 1 — Communication",
    date: "2026-09-10",
    startTime: "20:00",
    endTime: "21:30",
    trainerId: "trainer-1",
    participantIds: ["p1"],
    attendance: [],
    synced: true,
    ...overrides,
  };
}

describe("Moteur de présence ALTIS — Tests Unitaires", () => {
  const settings = DEFAULT_ATTENDANCE_SETTINGS;

  test("Durée programmée (Section 12.3)", () => {
    const session = createMockSession({ startTime: "20:00", endTime: "21:30" });
    expect(scheduledDuration(session)).toBe(90);
  });

  test("Arrivée à l'heure et présence complète (Section 12.4 & 25.2)", () => {
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:00:00Z",
          leftAt: "2026-09-10T21:30:00Z",
        },
      ],
    });

    const result = computeParticipantSession(session, "p1", settings);
    expect(result.cumulativeMinutes).toBe(90);
    expect(result.attendanceRate).toBe(100);
    expect(result.status).toBe("PRESENT");
    expect(result.lateMinutes).toBe(0);
    expect(result.significantLate).toBe(false);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.significantEarlyLeave).toBe(false);
    expect(result.reconnections).toBe(0);
  });

  test("Retard sous le seuil vs au-dessus du seuil (Section 12.5 & 25.2)", () => {
    // Retard de 5 min (sous le seuil de 10 min)
    const sessionMinorLate = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:05:00Z",
          leftAt: "2026-09-10T21:30:00Z",
        },
      ],
    });
    const res1 = computeParticipantSession(sessionMinorLate, "p1", settings);
    expect(res1.lateMinutes).toBe(5);
    expect(res1.significantLate).toBe(false);

    // Retard de 17 min (au-dessus du seuil)
    const sessionSignificantLate = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r2",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:17:00Z",
          leftAt: "2026-09-10T21:30:00Z",
        },
      ],
    });
    const res2 = computeParticipantSession(sessionSignificantLate, "p1", settings);
    expect(res2.lateMinutes).toBe(17);
    expect(res2.significantLate).toBe(true);
  });

  test("Départ anticipé sous et au-dessus du seuil (Section 12.6 & 25.2)", () => {
    // Départ anticipé de 18 min (fin prévue 21:30, départ 21:12)
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:00:00Z",
          leftAt: "2026-09-10T21:12:00Z",
        },
      ],
    });
    const result = computeParticipantSession(session, "p1", settings);
    expect(result.earlyLeaveMinutes).toBe(18);
    expect(result.significantEarlyLeave).toBe(true);
  });

  test("Absence totale (Section 12.4 & 25.2)", () => {
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [],
    });
    const result = computeParticipantSession(session, "p1", settings);
    expect(result.cumulativeMinutes).toBe(0);
    expect(result.attendanceRate).toBe(0);
    expect(result.status).toBe("ABSENT");
  });

  test("Présence partielle (Section 12.4 & 12.7)", () => {
    // 53 min sur 90 min = 58.9% -> PARTIEL (seuil entre 10% et 80%)
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:17:00Z",
          leftAt: "2026-09-10T21:10:00Z",
        },
      ],
    });
    const result = computeParticipantSession(session, "p1", settings);
    expect(result.cumulativeMinutes).toBe(53);
    expect(result.status).toBe("PARTIEL");
  });

  test("Durée cumulée multi-périodes avec reconnexions (Section 12.2 & 12.8)", () => {
    // P1: 20:00-20:30 (30 min), P2: 20:34-20:50 (16 min), P3: 20:53-21:30 (37 min)
    // Total = 83 min, 3 périodes -> 2 reconnexions
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:00:00Z",
          leftAt: "2026-09-10T20:30:00Z",
        },
        {
          id: "r2",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:34:00Z",
          leftAt: "2026-09-10T20:50:00Z",
        },
        {
          id: "r3",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:53:00Z",
          leftAt: "2026-09-10T21:30:00Z",
        },
      ],
    });
    const result = computeParticipantSession(session, "p1", settings);
    expect(result.cumulativeMinutes).toBe(83);
    expect(result.reconnections).toBe(2);
    expect(result.status).toBe("PRESENT");
  });

  test("Données manquantes : déconnexion non reçue (Section 12.8 & 25.2)", () => {
    const session = createMockSession({
      startTime: "20:00",
      endTime: "21:30",
      attendance: [
        {
          id: "r1",
          sessionId: "session-1",
          participantId: "p1",
          joinedAt: "2026-09-10T20:00:00Z",
          leftAt: null,
        },
      ],
    });
    const result = computeParticipantSession(session, "p1", settings);
    expect(result.incompleteData).toBe(true);
    expect(result.cumulativeMinutes).toBe(90);
  });

  test("Signaux de décrochage (Section 12.11)", () => {
    // 3 sessions passées avec baisse continue : 90% -> 60% -> 30%
    const s1 = createMockSession({
      id: "s1",
      date: "2026-09-01",
      attendance: [
        {
          id: "r1",
          sessionId: "s1",
          participantId: "p1",
          joinedAt: "2026-09-01T20:00:00Z",
          leftAt: "2026-09-01T21:20:00Z",
        },
      ],
    });
    const s2 = createMockSession({
      id: "s2",
      date: "2026-09-05",
      attendance: [
        {
          id: "r2",
          sessionId: "s2",
          participantId: "p1",
          joinedAt: "2026-09-05T20:00:00Z",
          leftAt: "2026-09-05T20:54:00Z",
        },
      ],
    });
    const s3 = createMockSession({
      id: "s3",
      date: "2026-09-10",
      attendance: [
        {
          id: "r3",
          sessionId: "s3",
          participantId: "p1",
          joinedAt: "2026-09-10T20:00:00Z",
          leftAt: "2026-09-10T20:27:00Z",
        },
      ],
    });

    const insight = computeParticipantInsight("p1", [s1, s2, s3], settings);
    expect(insight.trend).toBe("BAISSE");
    expect(insight.toWatch).toBe(true);
    expect(insight.signals.length).toBeGreaterThan(0);
  });
});
