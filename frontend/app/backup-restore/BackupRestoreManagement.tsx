"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { Cloud, Download, Database, Loader2, Play, RotateCcw } from "lucide-react";
import { FormModal } from "../components/ui/form-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type BackupFile = {
  key: string;
  label: string;
  fileName: string;
  sizeBytes: number;
};

type CloudUpload = {
  provider: string;
  success: boolean;
  message?: string;
};

type BackupDay = {
  date: string;
  createdAt: string;
  trigger: string;
  files: BackupFile[];
  zipFileName?: string;
  zipSizeBytes?: number;
  emailSent: boolean;
  cloudUploads?: CloudUpload[];
};

type RestoreLog = {
  id: number;
  username: string | null;
  backupDate: string;
  fileName: string;
  fileLabel: string | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  createdAt: string;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN");
  } catch {
    return iso;
  }
}

export function BackupRestoreManagement() {
  const user = useCurrentUser();
  const [items, setItems] = useState<BackupDay[]>([]);
  const [restoreLogs, setRestoreLogs] = useState<RestoreLog[]>([]);
  const [backupRoot, setBackupRoot] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [cloudRunning, setCloudRunning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{
    date: string;
    fileName: string;
    label: string;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/backup`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setRestoreLogs(Array.isArray(data.restoreLogs) ? data.restoreLogs : []);
      setBackupRoot(data.backupRoot || "");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load backups");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "SUPERADMIN") void load();
  }, [user, load]);

  const runBackup = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${BACKEND}/backup/run`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const manifest = await res.json();
      toast.success(`Backup completed for ${manifest.date}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setRunning(false);
    }
  };

  const runWeeklyCloud = async () => {
    setCloudRunning(true);
    try {
      const res = await fetch(`${BACKEND}/backup/cloud/weekly`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Weekly cloud backup uploaded");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Cloud backup failed");
    } finally {
      setCloudRunning(false);
    }
  };

  const handleDownload = async (date: string, fileName: string) => {
    try {
      const res = await fetch(`${BACKEND}/backup/download/${date}/${fileName}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${date}-${fileName}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download backup file");
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch(`${BACKEND}/backup/restore`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          date: restoreTarget.date,
          fileName: restoreTarget.fileName,
          fileLabel: restoreTarget.label,
          confirm: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Database restore completed");
      setRestoreTarget(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
      await load();
    } finally {
      setRestoring(false);
    }
  };

  if (user?.role !== "SUPERADMIN") {
    return (
      <div className="p-6 text-gray-500 text-sm">Only Super Admin can access backup and restore.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-600 text-sm">
            Daily backup at <strong>11:59 PM</strong>. SQL sections are zipped, emailed via SMTP, and
            uploaded to cloud (S3 / Dropbox / Google Drive when configured). Weekly cloud archive runs
            on Sundays.
          </p>
          {backupRoot && (
            <p className="text-xs text-gray-400 mt-1">Storage: {backupRoot}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runWeeklyCloud()} disabled={cloudRunning}>
            {cloudRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 mr-2" />
            )}
            Weekly cloud backup
          </Button>
          <Button onClick={() => void runBackup()} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run backup now
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            Backup history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No backups yet. Run a backup to create the first archive.</p>
          ) : (
            <div className="space-y-4">
              {items.map((day) => (
                <div key={day.date} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{day.date}</p>
                      <p className="text-xs text-gray-500">
                        {fmtWhen(day.createdAt)} · {day.trigger}
                        {day.emailSent ? " · emailed" : ""}
                        {day.zipFileName && day.zipSizeBytes != null
                          ? ` · ZIP ${fmtSize(day.zipSizeBytes)}`
                          : ""}
                      </p>
                      {day.cloudUploads && day.cloudUploads.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Cloud:{" "}
                          {day.cloudUploads
                            .map((c) => `${c.provider}${c.success ? " ✓" : " ✗"}`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    {day.zipFileName && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDownload(day.date, day.zipFileName!)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download ZIP
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {day.files.map((f) => (
                      <div
                        key={`${day.date}-${f.fileName}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{f.label}</span>
                          <span className="text-gray-500 ml-2">{f.fileName}</span>
                          <span className="text-gray-400 ml-2">({fmtSize(f.sizeBytes)})</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDownload(day.date, f.fileName)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Download
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                            onClick={() =>
                              setRestoreTarget({
                                date: day.date,
                                fileName: f.fileName,
                                label: f.label,
                              })
                            }
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Restore history</CardTitle>
        </CardHeader>
        <CardContent>
          {restoreLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No restore operations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Backup</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restoreLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmtWhen(log.createdAt)}
                      </TableCell>
                      <TableCell>{log.username || "—"}</TableCell>
                      <TableCell>{log.backupDate}</TableCell>
                      <TableCell className="text-xs">{log.fileLabel || log.fileName}</TableCell>
                      <TableCell>
                        <span className={log.success ? "text-green-700" : "text-red-600"}>
                          {log.success ? "Success" : "Failed"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{log.ipAddress || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormModal
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        title="Restore database"
        description="This will overwrite current data with the selected SQL backup. Use with caution."
        size="md"
        closeLabel="Cancel"
      >
        {restoreTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Restore <strong>{restoreTarget.label}</strong> from{" "}
              <strong>{restoreTarget.date}</strong> ({restoreTarget.fileName})?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Recommended: restore only the sectional file you need (e.g. attendance). Full-database
              restore replaces all tables.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setRestoreTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={restoring}
                onClick={() => void confirmRestore()}
              >
                {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm restore
              </Button>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
