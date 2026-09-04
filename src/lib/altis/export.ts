import {
  formatDate,
  formatMinutes,
  formatPercent,
  formatTime,
  participantName,
  participantPrograms,
  sessionProgram,
  trainerName,
} from "./selectors";
import {
  computeParticipantInsight,
  computeSessionReport,
  PRESENCE_STATUS_LABEL,
  type SessionReport,
} from "./presence";
import type { AltisData, Participant, Program } from "./types";

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8;"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

/**
 * Exporte la feuille d'émargement d'une session au format CSV compatible Excel (UTF-8 avec BOM).
 */
export function exportSessionReportToCsv(report: SessionReport, data: AltisData): void {
  const { session } = report;
  const { program, module } = sessionProgram(data, session);
  const trainer = trainerName(data, session.trainerId);

  const lines: string[] = [
    // BOM pour forcer Excel à lire en UTF-8 avec accents
    "\uFEFF",
    "RAPPORT DE PRÉSENCE ET D'ÉMARGEMENT — ALTIS",
    `Organisation;${escapeCsv(data.organization.name)}`,
    `Programme;${escapeCsv(program?.name || "-")}`,
    `Module;${escapeCsv(module?.name || "-")}`,
    `Session;${escapeCsv(session.name)}`,
    `Date;${escapeCsv(formatDate(session.date))}`,
    `Horaires;${escapeCsv(`${session.startTime} - ${session.endTime}`)}`,
    `Formateur;${escapeCsv(trainer)}`,
    `Taux moyen de présence;${escapeCsv(formatPercent(report.globalRate))}`,
    `Présents / Attendus;${escapeCsv(`${report.present}/${report.expected}`)} (Partiels: ${report.partial}, Absents: ${report.absent})`,
    `Lien de réunion;${escapeCsv(session.meeting?.url || "-")}`,
    "",
    [
      "Nom",
      "Prénom",
      "Email",
      "Téléphone",
      "Première connexion",
      "Dernière déconnexion",
      "Durée cumulée (min)",
      "Taux de présence (%)",
      "Retard (min)",
      "Départ anticipé (min)",
      "Reconnexions",
      "Statut de présence",
      "Observations",
    ].join(";"),
  ];

  for (const row of report.rows) {
    const participant = data.participants.find((p) => p.id === row.participantId);
    const observations: string[] = [];
    if (row.unstableConnection) observations.push("Connexion instable");
    if (row.incompleteData) observations.push("Donnée incomplète");
    if (row.significantLate) observations.push(`Retard significatif (${row.lateMinutes} min)`);
    if (row.significantEarlyLeave)
      observations.push(`Départ anticipé (${row.earlyLeaveMinutes} min)`);

    lines.push(
      [
        escapeCsv(participant?.lastName || "-"),
        escapeCsv(participant?.firstName || "-"),
        escapeCsv(participant?.email || "-"),
        escapeCsv(participant?.phone || "-"),
        escapeCsv(formatTime(row.firstJoin)),
        escapeCsv(formatTime(row.lastLeave)),
        escapeCsv(row.cumulativeMinutes),
        escapeCsv(Math.round(Math.min(100, row.attendanceRate))),
        escapeCsv(row.lateMinutes),
        escapeCsv(row.earlyLeaveMinutes),
        escapeCsv(row.reconnections),
        escapeCsv(PRESENCE_STATUS_LABEL[row.status]),
        escapeCsv(observations.join(" | ") || "Conforme"),
      ].join(";"),
    );
  }

  const filename = `ALTIS_Emargement_${sanitizeFilename(session.name)}_${session.date}.csv`;
  downloadFile(filename, lines.join("\r\n"));
}

/**
 * Génère et ouvre une feuille d'émargement officielle propre et imprimable / enregistrable en PDF.
 */
export function printSessionAttendanceSheet(report: SessionReport, data: AltisData): void {
  const { session } = report;
  const { program, module } = sessionProgram(data, session);
  const trainer = trainerName(data, session.trainerId);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer la feuille d'émargement.");
    return;
  }

  const rowsHtml = report.rows
    .map((row) => {
      const p = data.participants.find((x) => x.id === row.participantId);
      const statusClass =
        row.status === "PRESENT"
          ? "status-present"
          : row.status === "PARTIEL"
            ? "status-partial"
            : "status-absent";

      return `
      <tr>
        <td><strong>${p ? `${p.lastName.toUpperCase()} ${p.firstName}` : "-"}</strong></td>
        <td>${p?.email || "-"}</td>
        <td class="center">${formatTime(row.firstJoin)}</td>
        <td class="center">${formatTime(row.lastLeave)}</td>
        <td class="center">${formatMinutes(row.cumulativeMinutes)}</td>
        <td class="center">${row.lateMinutes > 0 ? `${row.lateMinutes} min` : "-"}</td>
        <td class="center"><span class="badge ${statusClass}">${PRESENCE_STATUS_LABEL[row.status]}</span></td>
        <td class="signature-cell"></td>
      </tr>
    `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Feuille d'émargement — ${session.name} (${formatDate(session.date)})</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.4; font-size: 12px; margin: 0; padding: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: 1px; color: #3b82f6; }
    .title { font-size: 16px; font-weight: 700; text-transform: uppercase; margin: 0; color: #0f172a; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
    .meta-item strong { color: #475569; display: inline-block; width: 110px; font-size: 11px; text-transform: uppercase; }
    .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; }
    .stat-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    .stat-val { font-size: 18px; font-weight: 700; color: #0f172a; }
    .stat-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .center { text-align: center; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-weight: 600; font-size: 9px; }
    .status-present { background: #dcfce7; color: #15803d; }
    .status-partial { background: #fef3c7; color: #b45309; }
    .status-absent { background: #fee2e2; color: #b91c1c; }
    .signature-cell { width: 100px; border-left: 1px dashed #cbd5e1; }
    .signatures-block { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; page-break-inside: avoid; }
    .sig-box { border: 1px solid #cbd5e1; border-radius: 6px; height: 75px; padding: 8px; font-size: 10px; color: #64748b; }
    .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">ALTIS</div>
      <div style="font-size: 10px; color: #64748b;">Pilotage de formations en ligne</div>
    </div>
    <div style="text-align: right;">
      <h1 class="title">Feuille d'émargement</h1>
      <div style="font-size: 11px; color: #475569;">Générée le ${new Date().toLocaleDateString("fr-FR")}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><strong>Organisation :</strong> ${data.organization.name}</div>
    <div class="meta-item"><strong>Date :</strong> ${formatDate(session.date)}</div>
    <div class="meta-item"><strong>Programme :</strong> ${program?.name || "-"}</div>
    <div class="meta-item"><strong>Horaires :</strong> ${session.startTime} – ${session.endTime}</div>
    <div class="meta-item"><strong>Module :</strong> ${module?.name || "-"}</div>
    <div class="meta-item"><strong>Formateur :</strong> ${trainer}</div>
    <div class="meta-item" style="grid-column: span 2;"><strong>Session :</strong> ${session.name}</div>
  </div>

  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-val">${report.expected}</div>
      <div class="stat-lbl">Participants attendus</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #15803d;">${report.present}</div>
      <div class="stat-lbl">Présents</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #b45309;">${report.partial}</div>
      <div class="stat-lbl">Partiels / Retards</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color: #2563eb;">${formatPercent(report.globalRate)}</div>
      <div class="stat-lbl">Taux de présence</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Participant</th>
        <th>Email</th>
        <th class="center">1re Connexion</th>
        <th class="center">Dern. Déconnexion</th>
        <th class="center">Durée</th>
        <th class="center">Retard</th>
        <th class="center">Statut</th>
        <th class="center">Signature / Visa</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="signatures-block">
    <div class="sig-box">
      <strong>Visa du Formateur :</strong> ${trainer}
    </div>
    <div class="sig-box">
      <strong>Visa du Responsable Organisme :</strong> ${data.organization.name}
    </div>
  </div>

  <div class="footer">
    Document généré par ALTIS · Données issues des connexions vérifiées Google Meet · Conforme aux exigences d'audit et de traçabilité.
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Exporte la liste des participants avec leurs indicateurs de présence.
 */
export function exportParticipantsToCsv(participants: Participant[], data: AltisData): void {
  const lines: string[] = [
    "\uFEFF",
    "LISTE DES PARTICIPANTS — ALTIS",
    `Organisation;${escapeCsv(data.organization.name)}`,
    `Date d'export;${escapeCsv(new Date().toLocaleDateString("fr-FR"))}`,
    `Total participants;${escapeCsv(participants.length)}`,
    "",
    [
      "Nom",
      "Prénom",
      "Email",
      "Téléphone",
      "Programmes inscrits",
      "Sessions suivies",
      "Sessions manquées",
      "Score de présence (%)",
      "Tendance",
      "Statut de suivi",
      "Signaux de décrochage",
    ].join(";"),
  ];

  for (const p of participants) {
    const insight = computeParticipantInsight(p.id, data.sessions, data.organization.attendanceSettings);
    const progs = participantPrograms(data, p.id).map((pr) => pr.name).join(", ");

    lines.push(
      [
        escapeCsv(p.lastName),
        escapeCsv(p.firstName),
        escapeCsv(p.email),
        escapeCsv(p.phone || "-"),
        escapeCsv(progs || "-"),
        escapeCsv(insight.attended),
        escapeCsv(insight.missed),
        escapeCsv(Math.round(insight.presenceScore)),
        escapeCsv(insight.trend),
        escapeCsv(insight.toWatch ? "À surveiller" : "Actif"),
        escapeCsv(insight.signals.join(" | ") || "-"),
      ].join(";"),
    );
  }

  const filename = `ALTIS_Participants_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(filename, lines.join("\r\n"));
}

/**
 * Exporte le bilan global d'un programme.
 */
export function exportProgramReportToCsv(program: Program, data: AltisData): void {
  const modules = data.modules.filter((m) => m.programId === program.id);
  const sessions = data.sessions.filter((s) => modules.some((m) => m.id === s.moduleId));

  const lines: string[] = [
    "\uFEFF",
    "BILAN DE FORMATION DU PROGRAMME — ALTIS",
    `Organisation;${escapeCsv(data.organization.name)}`,
    `Programme;${escapeCsv(program.name)}`,
    `Période;${escapeCsv(program.startDate ? `Du ${formatDate(program.startDate)} au ${program.endDate ? formatDate(program.endDate) : "-"}` : "Non renseignée")}`,
    `Modules;${escapeCsv(modules.length)}`,
    `Sessions;${escapeCsv(sessions.length)}`,
    `Participants inscrits;${escapeCsv(program.participantIds.length)}`,
    "",
    [
      "Module",
      "Session",
      "Date",
      "Horaires",
      "Formateur",
      "Statut",
      "Participants attendus",
      "Présents",
      "Taux de présence (%)",
    ].join(";"),
  ];

  for (const s of sessions) {
    const mod = modules.find((m) => m.id === s.moduleId);
    const report = computeSessionReport(s, data.organization.attendanceSettings);
    lines.push(
      [
        escapeCsv(mod?.name || "-"),
        escapeCsv(s.name),
        escapeCsv(formatDate(s.date)),
        escapeCsv(`${s.startTime} - ${s.endTime}`),
        escapeCsv(trainerName(data, s.trainerId)),
        escapeCsv(s.cancelled ? "Annulée" : s.synced ? "Synchronisée" : "Planifiée"),
        escapeCsv(report.expected),
        escapeCsv(report.present),
        escapeCsv(s.synced ? Math.round(report.globalRate) : "-"),
      ].join(";"),
    );
  }

  const filename = `ALTIS_Bilan_${sanitizeFilename(program.name)}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(filename, lines.join("\r\n"));
}
