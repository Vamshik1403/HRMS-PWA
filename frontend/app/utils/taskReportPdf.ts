import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { taskFetch, type CurrentUserLike } from "./taskApi";

export type TaskReportData = {
  generatedAt: string;
  task: Record<string, unknown>;
  assignees: Array<Record<string, unknown>>;
  siteCheckSummary: { totalEvents: number; events: Array<Record<string, unknown>> };
  remarks: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  stats: Record<string, number>;
};

function fmtDt(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN");
}

export async function fetchTaskReport(taskId: number, user: CurrentUserLike | null): Promise<TaskReportData> {
  return taskFetch<TaskReportData>(`/task-projects/${taskId}/report`, user);
}

export function downloadTaskReportPdf(report: TaskReportData, fileName?: string) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.width;
  const task = report.task as Record<string, unknown>;
  const isSiteVisit = String(task.taskType || "").toLowerCase().includes("site visit");
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Task Activity Report", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${fmtDt(report.generatedAt)}`, 14, y);
  y += 6;
  doc.text(`Task: ${task.taskCode || ""} — ${task.taskName || ""}`, 14, y);
  y += 5;
  doc.text(
    `Type: ${task.taskType || "—"}  |  Status: ${task.status || "—"}  |  Priority: ${task.priority || "—"}`,
    14,
    y,
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8 },
    head: [["Field", "Value"]],
    body: [
      ["Customer", (task.customer as { customerName?: string })?.customerName || "—"],
      ["Site", (task.site as { branchName?: string })?.branchName || "—"],
      ["Department", (task.department as { departmentName?: string })?.departmentName || "—"],
      ["Scheduled", fmtDt(task.scheduleDateTime)],
      ["Due", fmtDt(task.dueDateTime)],
      ["Created", fmtDt(task.createdAt)],
      ["Description", String(task.description || "—")],
    ],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  const assigneeRows = (report.assignees || []).map((a) => [
    String(a.employeeCode || "—"),
    String(a.name || "—"),
    String(a.siteCheckInCount ?? 0),
    String(a.siteCheckOutCount ?? 0),
    String(a.messageCount ?? 0),
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Assigned employees", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8 },
    head: [["Emp ID", "Name", "Site IN", "Site OUT", "Chat msgs"]],
    body: assigneeRows.length ? assigneeRows : [["—", "No assignees", "", "", ""]],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 8;

  const siteRows = (report.siteCheckSummary?.events || []).map((e) => [
    fmtDt(e.at),
    String(e.employeeName || "—"),
    String(e.message || "—").replace(/\s+at\s+[\d/,: apm]+/i, "").trim() || String(e.message || "—"),
  ]);

  if (isSiteVisit || siteRows.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Site attendance (check-in / check-out)", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      "Site mark-in and mark-out are recorded here only — they are not counted as team chat messages.",
      14,
      y,
      { maxWidth: pageWidth - 28 },
    );
    doc.setTextColor(0, 0, 0);
    y += 10;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8 },
      head: [["Time", "Employee", "Event"]],
      body: siteRows.length ? siteRows : [["—", "—", "No site attendance recorded"]],
      margin: { left: 14, right: 14 },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  const chatMessages = report.messages || [];
  if (chatMessages.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 14;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Team chat messages", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8 },
      head: [["Time", "From", "Message"]],
      body: chatMessages.map((m) => [
        fmtDt(m.at),
        String(m.senderName || m.employeeID || "—"),
        String(m.message || "").slice(0, 120),
      ]),
      margin: { left: 14, right: 14 },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  const code = String(task.taskCode || task.id || "task");
  doc.save(fileName || `Task_Report_${code}.pdf`);
}

export async function downloadTaskReportForId(
  taskId: number,
  user: CurrentUserLike | null,
  taskCode?: string,
) {
  const report = await fetchTaskReport(taskId, user);
  downloadTaskReportPdf(report, taskCode ? `Task_Report_${taskCode}.pdf` : undefined);
}
