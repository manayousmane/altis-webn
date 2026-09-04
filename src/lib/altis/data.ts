import { DEFAULT_ATTENDANCE_SETTINGS } from "./presence";
import type {
  AltisData,
  AttendanceRecord,
  Module,
  Participant,
  Program,
  Trainer,
  TrainingSession,
} from "./types";

/** Générateur pseudo-aléatoire déterministe (données de démonstration stables). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const d = new Date(`${date}T${time}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

const TRAINERS: Trainer[] = [
  { id: "t1", firstName: "Amina", lastName: "Diallo", email: "amina.diallo@altis.io", phone: "+229 61 20 40 11" },
  { id: "t2", firstName: "Karim", lastName: "Benali", email: "karim.benali@altis.io", phone: "+229 61 20 40 12" },
  { id: "t3", firstName: "Sarah", lastName: "Kouassi", email: "sarah.kouassi@altis.io", phone: "+229 61 20 40 13" },
  { id: "t4", firstName: "Julien", lastName: "Mercier", email: "julien.mercier@altis.io", phone: "+229 61 20 40 14" },
];

const PARTICIPANT_NAMES: [string, string][] = [
  ["Marie", "Adjovi"], ["Paul", "Houngbo"], ["Fatou", "Sow"], ["Léa", "Dossou"],
  ["Ibrahim", "Traoré"], ["Chloé", "Agbo"], ["Yann", "Kponou"], ["Nadia", "Bakayoko"],
  ["Samuel", "Zinsou"], ["Awa", "Camara"], ["Hugo", "Lemaire"], ["Rita", "Oyewole"],
  ["Moussa", "Keita"], ["Elodie", "Tchibozo"], ["Kevin", "Ahouandjinou"], ["Sonia", "Bello"],
  ["Thomas", "Gnansounou"], ["Inès", "Sagbo"], ["Franck", "Aholou"], ["Grace", "Okou"],
  ["Aymane", "Ousmane"], ["Djamila", "Toure"], ["Serge", "Ametepe"], ["Laure", "Kponton"],
];

const PARTICIPANTS: Participant[] = PARTICIPANT_NAMES.map(([firstName, lastName], i) => ({
  id: `p${i + 1}`,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@exemple.com`,
  phone: `+229 97 ${String(10 + i).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")}`,
}));

interface ProgramSeed {
  id: string;
  name: string;
  description: string;
  participants: string[];
  modules: { name: string; description: string; sessions: string[] }[];
}

const PROGRAM_SEEDS: ProgramSeed[] = [
  {
    id: "prog-paje",
    name: "PAJE ACADEMY",
    description:
      "Programme de développement personnel et professionnel pour jeunes actifs, en 12 séances en ligne.",
    participants: PARTICIPANTS.slice(0, 20).map((p) => p.id),
    modules: [
      {
        name: "Développement personnel et connaissance de soi",
        description: "Identifier ses forces, ses moteurs et ses axes de progression.",
        sessions: ["Séance 1 - Se connaître", "Séance 2 - Forces et limites", "Séance 3 - Plan personnel"],
      },
      {
        name: "Discipline, habitudes et gestion du temps",
        description: "Construire des routines soutenables et prioriser.",
        sessions: ["Séance 1 - Routines", "Séance 2 - Priorisation", "Séance 3 - Suivi d'habitudes"],
      },
      {
        name: "Communication et prise de parole",
        description: "Structurer un message et convaincre à l'oral.",
        sessions: ["Séance 1 - Structurer", "Séance 2 - Prise de parole", "Séance 3 - Feedback"],
      },
    ],
  },
  {
    id: "prog-data",
    name: "DATA POUR MANAGERS",
    description: "Comprendre et piloter avec la donnée sans être analyste.",
    participants: PARTICIPANTS.slice(14, 24).map((p) => p.id),
    modules: [
      {
        name: "Culture de la donnée",
        description: "Vocabulaire, sources, qualité de la donnée.",
        sessions: ["Séance 1 - Fondamentaux", "Séance 2 - Qualité des données"],
      },
      {
        name: "Indicateurs et tableaux de bord",
        description: "Choisir les bons indicateurs et les lire correctement.",
        sessions: ["Séance 1 - Choisir ses KPI", "Séance 2 - Lire un dashboard"],
      },
    ],
  },
  {
    id: "prog-lead",
    name: "LEADERSHIP TERRAIN",
    description: "Encadrer une équipe opérationnelle au quotidien.",
    participants: PARTICIPANTS.slice(4, 16).map((p) => p.id),
    modules: [
      {
        name: "Posture managériale",
        description: "Cadre, confiance, exemplarité.",
        sessions: ["Séance 1 - Poser le cadre", "Séance 2 - Entretiens individuels"],
      },
    ],
  },
];

function buildAttendance(
  session: Omit<TrainingSession, "attendance" | "synced">,
  participantIds: string[],
  rand: () => number,
  sessionIndex: number,
): AttendanceRecord[] {
  const duration =
    (new Date(`${session.date}T${session.endTime}:00`).getTime() -
      new Date(`${session.date}T${session.startTime}:00`).getTime()) /
    60000;
  const records: AttendanceRecord[] = [];

  participantIds.forEach((participantId, i) => {
    const roll = rand();
    // Quelques participants "à surveiller" : décrochage progressif.
    const fragile = i % 7 === 1;
    const drop = fragile ? sessionIndex * 0.14 : 0;

    if (roll < 0.05 + drop) return; // absence totale : aucune donnée brute

    const late = roll < 0.28 ? Math.round(rand() * 22) : Math.round(rand() * 4);
    const early = roll < 0.22 ? Math.round(rand() * 25) : 0;
    const splits = roll < 0.18 ? 3 : roll < 0.4 ? 2 : 1;

    let cursor = late;
    const usable = Math.max(10, duration - late - early);
    const slice = usable / splits;
    for (let s = 0; s < splits; s++) {
      const gap = s === 0 ? 0 : 3 + Math.round(rand() * 4);
      cursor += gap;
      const stay = Math.max(4, Math.round(slice - gap));
      const missingLeave = fragile && s === splits - 1 && rand() < 0.08;
      records.push({
        participantId,
        joinedAt: addMinutes(session.date, session.startTime, cursor),
        leftAt: missingLeave ? null : addMinutes(session.date, session.startTime, cursor + stay),
      });
      cursor += stay;
    }
  });

  return records;
}

export function createSeedData(): AltisData {
  const rand = mulberry32(20260814);
  const programs: Program[] = [];
  const modules: Module[] = [];
  const sessions: TrainingSession[] = [];

  // Les séances passées sont espacées d'une semaine, les suivantes à venir.
  let dayOffset = -63;

  PROGRAM_SEEDS.forEach((seed) => {
    programs.push({
      id: seed.id,
      name: seed.name,
      description: seed.description,
      startDate: isoDate(-70),
      endDate: isoDate(45),
      participantIds: seed.participants,
    });

    seed.modules.forEach((mod, mIndex) => {
      const moduleId = `${seed.id}-m${mIndex + 1}`;
      modules.push({
        id: moduleId,
        programId: seed.id,
        name: mod.name,
        description: mod.description,
        order: mIndex + 1,
        createdAt: isoDate(-70),
      });

      mod.sessions.forEach((sessionName, sIndex) => {
        const id = `${moduleId}-s${sIndex + 1}`;
        dayOffset += 7;
        const date = isoDate(dayOffset);
        const trainer = TRAINERS[(mIndex + sIndex) % TRAINERS.length]!;
        const base: Omit<TrainingSession, "attendance" | "synced"> = {
          id,
          moduleId,
          name: sessionName,
          date,
          startTime: "20:00",
          endTime: "21:30",
          trainerId: trainer.id,
          participantIds: seed.participants,
          meeting: {
            sessionId: id,
            provider: "GOOGLE_MEET",
            url: `https://meet.google.com/altis-${id}`,
            code: `altis-${id}`,
          },
        };
        const isPast = dayOffset < 0;
        sessions.push({
          ...base,
          synced: isPast,
          attendance: isPast ? buildAttendance(base, seed.participants, rand, sIndex + mIndex) : [],
        });
      });
    });
  });

  // Une session terminée non encore synchronisée + une session en erreur d'intégration.
  const pending = sessions.find((s) => s.synced);
  if (pending) {
    pending.synced = false;
    pending.attendance = [];
  }
  const upcoming = sessions.find((s) => new Date(`${s.date}T${s.startTime}:00`) > new Date());
  if (upcoming) {
    upcoming.integrationError =
      "La création de la réunion Google Meet a échoué (quota atteint ou permission révoquée).";
    delete upcoming.meeting;
  }

  return {
    organization: {
      id: "org-1",
      name: "ALTIS Formation",
      timezone: "Africa/Lagos",
      googleConnected: true,
      googleAccount: "formation@altis.io",
      attendanceSettings: { ...DEFAULT_ATTENDANCE_SETTINGS },
    },
    programs,
    modules,
    sessions,
    trainers: TRAINERS,
    participants: PARTICIPANTS,
  };
}