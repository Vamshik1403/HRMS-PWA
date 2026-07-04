"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { NoticeBanner } from "../components/ui/notice-banner";
import { Upload, Download, Trash2, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface ImportResult {
  success: boolean;
  totalRowsInFile: number;
  recordsInserted: number;
  errorsCount: number;
  errors: { row: number; error: string }[];
}

interface DeleteResult {
  success: boolean;
  deletedCount: number;
  message: string;
}

export function ImportAttendanceManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
    setError(null);
    setDeleteResult(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);
    setDeleteResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BACKEND_URL}/import-attendance/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Upload failed with status ${res.status}`);
      }
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Attendance imported successfully");
    } catch (err: any) {
      setError(err.message || "Upload failed");
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/import-attendance/template`);
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully");
    } catch (err: any) {
      setError(err.message || "Failed to download template");
      toast.error(err.message || "Failed to download template");
    }
  }, []);

  const handleDeleteImported = useCallback(async () => {
    if (!confirm("Are you sure you want to delete ALL imported attendance records? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteResult(null);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/import-attendance/imported`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setDeleteResult(data);
      toast.success(data.message || "Records deleted successfully");
    } catch (err: any) {
      setError(err.message || "Delete failed");
      toast.error(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Import Attendance</h2>
          <p className="text-sm text-gray-500 mt-1">
            Import attendance logs from CSV or Excel files into the system.
          </p>
        </div>
      </div>

      {/* Instructions Card */}
{/* Instructions Card */}
<Card>
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
      Import Instructions
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3 text-sm text-gray-600">
      <p><strong>Supported formats:</strong> CSV (.csv), Excel (.xlsx, .xls)</p>
      
      <div>
        <p><strong>Required columns:</strong></p>
        <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
          <li><code className="bg-gray-100 px-1.5 py-0.5 rounded">user_id</code> - Employee ID</li>
          <li><code className="bg-gray-100 px-1.5 py-0.5 rounded">log_time</code> - Punch time</li>
          <li><code className="bg-gray-100 px-1.5 py-0.5 rounded">device_sn</code> - Device serial number</li>
        </ul>
      </div>
      
      <div>
        <p><strong>Optional column:</strong></p>
        <ul className="list-disc list-inside ml-4 mt-1">
          <li><code className="bg-gray-100 px-1.5 py-0.5 rounded">auth_type</code> - Authentication type (FINGER, CARD, FACE, PIN)</li>
        </ul>
      </div>
      
      <NoticeBanner
        variant="warning"
        title="Date format (DD/MM/YYYY)"
        className="mt-2"
      >
        <div className="space-y-2 text-[13px] text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Day first, then month.</strong> Use this exact format to avoid confusion.
          </p>
          <ul className="list-disc list-inside ml-1 space-y-1">
            <li><code className="bg-muted px-1 py-0.5 rounded text-foreground">01/02/2026 09:00:00</code> = 1st February 2026, 9:00 AM</li>
            <li><code className="bg-muted px-1 py-0.5 rounded text-foreground">15/12/2026 20:00:00</code> = 15th December 2026, 8:00 PM</li>
            <li><code className="bg-muted px-1 py-0.5 rounded text-foreground">1/2/2026 9:00</code> = 1st February 2026, 9:00 AM (shorter format accepted)</li>
          </ul>
          <p className="text-destructive text-xs">
            Do not use MM/DD/YYYY (US format) — it will be rejected or misinterpreted.
          </p>
        </div>
      </NoticeBanner>
      
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-xs">
          <strong>Note:</strong> The device must exist in the system with the provided device_sn.
        </p>
      </div>
      
      <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="mt-2">
        <Download className="w-4 h-4 mr-2" />
        Download Template (DD/MM/YYYY Format)
      </Button>
    </div>
  </CardContent>
</Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-600" />
            Upload File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="whitespace-nowrap"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
            {file && (
              <p className="text-sm text-gray-500">
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-green-800">Import Successful</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Total rows in file: <strong>{result.totalRowsInFile}</strong></p>
                  <p>Records inserted: <strong>{result.recordsInserted}</strong></p>
                  {result.errorsCount > 0 && (
                    <div className="mt-2">
                      <p className="text-orange-700">Rows with errors: <strong>{result.errorsCount}</strong></p>
                      <ul className="list-disc list-inside mt-1 text-orange-600 max-h-60 overflow-y-auto">
                        {result.errors.map((e, idx) => (
                          <li key={idx} className="text-xs">Row {e.row}: {e.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {deleteResult && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800">Delete Complete</h3>
                <p className="text-sm text-blue-700">{deleteResult.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone - Delete Imported */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Delete Imported Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Remove all previously imported attendance records from the system. 
            Only records marked as imported will be affected.
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteImported}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Imported Records
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}