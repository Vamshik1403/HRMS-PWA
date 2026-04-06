"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Upload, Download, Trash2, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ImportResult {
  success: boolean;
  totalRowsInFile: number;
  processAttLogsInserted: number;
  empAttendanceLogsInserted: number;
  errorsCount: number;
  errors: { row: number; error: string }[];
}

export function ImportAttendanceManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
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
    } catch (err: any) {
      setError(err.message || "Upload failed");
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
    } catch (err: any) {
      setError(err.message || "Failed to download template");
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
      setDeleteResult(
        `Deleted ${data.processAttLogsDeleted} process att logs and ${data.empAttendanceLogsDeleted} emp attendance logs.`
      );
    } catch (err: any) {
      setError(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">
            Import attendance punch logs from CSV or Excel files into the system.
          </p>
        </div>
      </div>

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
            <p><strong>Required columns:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded">user_id</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">punch_time</code></p>
            <p><strong>Optional columns:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded">device_sn</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">username</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">company_name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">branch_name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">department_name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">device_emp_code</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">manage_employee_id</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">device_id</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">device_name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">service_provider_id</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">company_id</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">branches_id</code></p>
            <p><strong>Punch time format:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded">YYYY-MM-DD HH:mm:ss</code> (e.g., 2025-03-01 09:00:00)</p>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800"><strong>Note:</strong> If <code className="bg-blue-100 px-1 py-0.5 rounded">manage_employee_id</code> (or <code className="bg-blue-100 px-1 py-0.5 rounded">employee_id</code>) is provided, records will also be inserted into the Employee Attendance Logs table, which is used for salary generation, overtime, and leave calculations.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="mt-2">
              <Download className="w-4 h-4 mr-2" />
              Download Template
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
                  <p>Process Att Logs inserted: <strong>{result.processAttLogsInserted}</strong></p>
                  <p>Emp Attendance Logs inserted: <strong>{result.empAttendanceLogsInserted}</strong></p>
                  {result.errorsCount > 0 && (
                    <div className="mt-2">
                      <p className="text-orange-700">Rows with errors: <strong>{result.errorsCount}</strong></p>
                      <ul className="list-disc list-inside mt-1 text-orange-600">
                        {result.errors.map((e, idx) => (
                          <li key={idx}>Row {e.row}: {e.error}</li>
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
                <p className="text-sm text-blue-700">{deleteResult}</p>
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
            Remove all previously imported attendance records from the system. This will delete records from both
            Process Att Logs and Emp Attendance Logs tables. Only records marked as imported will be affected.
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
