/**
 * Analyse un rapport de participation (Google Meet / Workspace) collé au format
 * CSV ou tabulé. Aucune extrapolation : seules les lignes exploitables sont
 * retenues, les horaires manquants restent nuls.
 */
export interface ParsedAttendanceLine {
  email: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface ParseResult {
  rows: ParsedAttendanceLine[];
  ignored: number;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function splitCells(line: string): string[] {
  const separator = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

/** Accepte "2024-05-12T20:03:00Z", "2024-05-12 20:03", "20:03" ou "20:03:12". */
function toIso(value: string, sessionDate: string): string | null {
  if (!value) return null;
  const direct = value.replace(" ", "T");
  const timeOnly = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/.exec(value);
  if (timeOnly) {
    const h = timeOnly[1]!.padStart(2, "0");
    const m = timeOnly[2]!;
    const s = timeOnly[4] ?? "00";
    const parsedLocal = new Date(`${sessionDate}T${h}:${m}:${s}`);
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal.toISOString();
  }
  const parsed = new Date(direct);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseMeetReport(raw: string, sessionDate: string): ParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedAttendanceLine[] = [];
  let ignored = 0;

  for (const line of lines) {
    const cells = splitCells(line);
    const emailCell = cells.find((c) => EMAIL_RE.test(c));
    const email = emailCell ? EMAIL_RE.exec(emailCell)?.[0] : undefined;
    if (!email) {
      ignored += 1;
      continue;
    }
    const times = cells
      .filter((c) => c !== emailCell)
      .map((c) => toIso(c, sessionDate))
      .filter((c): c is string => c !== null);

    if (times.length === 0) {
      ignored += 1;
      continue;
    }
    rows.push({
      email: email.toLowerCase(),
      joinedAt: times[0]!,
      leftAt: times[1] ?? null,
    });
  }

  return { rows, ignored };
}
