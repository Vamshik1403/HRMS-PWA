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
  doc.text(`Type: ${task.taskType || "—"}  |  Status: ${task.status || "—"}  |  Priority: ${task.priority || "—"}`, 14, y);
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
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Assigned employees & site check-in/out", 14, y);
  y += 4;

  const assigneeRows = (report.assignees || []).map((a) => [
    String(a.employeeCode || a.employeeId || "—"),
    String(a.name || "—"),
    String(a.department || "—"),
    String(a.siteCheckInOutCount ?? 0),
    String(a.messageCount ?? 0),
  ]);

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8 },
    head: [["Emp ID", "Name", "Department", "Site IN/OUT", "Messages"]],
    body: assigneeRows.length ? assigneeRows : [["—", "No assignees", "", "", ""]],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 6;

  const siteRows = (report.siteCheckSummary?.events || []).map((e) => [
    fmtDt(e.at),
    String(e.employeeName || "—"),
    String(e.message || "—"),
  ]);

  doc.setFont("helvetica", "bold");
  doc.text("Site check-in / check-out log", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7 },
    head: [["Time", "Employee", "Event"]],
    body: siteRows.length ? siteRows : [["—", "—", "No site punches recorded"]],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 6;

  if (y > 250) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Task messages", 14, y);
  y += 4;
  const msgRows = (report.messages || []).map((m) => [
    fmtDt(m.at),
    String(m.senderName || m.employeeID || "—"),
    String(m.message || "").slice(0, 120),
  ]);
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7 },
    head: [["Time", "From", "Message"]],
    body: msgRows.length ? msgRows : [["—", "—", "No messages"]],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 6;

  if (y > 250) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Remarks & activity", 14, y);
  y += 4;
  const remarkRows = (report.remarks || []).map((r) => [
    fmtDt(r.createdAt),
    String(r.authorName || "—"),
    String(r.remark || "").slice(0, 100),
  ]);
  const actRows = (report.activities || []).map((a) => [
    fmtDt(a.createdAt),
    String(a.action || "—"),
    [a.oldValue, a.newValue].filter(Boolean).join(" → ") || String(a.remark || ""),
  ]);
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7 },
    head: [["Time", "Author", "Remark"]],
    body: remarkRows.length ? remarkRows : [["—", "—", "No remarks"]],
    margin: { left: 14, right: 14 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 10;
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7 },
    head: [["Time", "Action", "Detail"]],
    body: actRows.length ? actRows : [["—", "—", "No activity"]],
    margin: { left: 14, right: 14 },
  });

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
