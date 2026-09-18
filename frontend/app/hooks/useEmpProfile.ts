"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearInAppNotifications } from "../utils/empInAppNotifications";
import {
  getPageCache,
  setPageCache,
  clearPageCache,
  clearPageCachesByPrefix,
} from "../utils/pageCache";
import { clearLegacyEmpPhoto, getEmpPhoto, setEmpPhoto } from "../utils/empPhotoCache";
import { applyEmpTheme, readStoredEmpTheme } from "../utils/empTheme";
import { clearActiveCompanySession } from "../utils/sidebarContext";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export function fmtJoined(dateStr: string | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function useEmpProfile() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empUser, setEmpUser] = useState<any>(null);
  const [empData, setEmpData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const fetchEmpData = useCallback(async (u: any, token: string) => {
    try {
      const empId = u?.employee?.id || u?.employeeId || u?.id;
      if (!empId) return;
      const res = await fetch(`${BACKEND}/manage-emp/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setEmpData(data);
      setPageCache("empProfileData", data);
      const url = data?.employeePhotoUrl || null;
      setPhotoUrl(url);
      setImgFailed(false);
      setEmpPhoto(empId, url);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      clearLegacyEmpPhoto();
      const s = localStorage.getItem("user");
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      if (s) {
        const u = JSON.parse(s);
        setEmpUser(u);
        const empId = u?.employee?.id || u?.employeeId || u?.id;
        const cached = getPageCache<any>("empProfileData");
        if (cached?.id === empId) {
          setEmpData(cached);
          setPhotoUrl(cached.employeePhotoUrl || getEmpPhoto(empId));
        } else {
          clearPageCache("empProfileData");
          setPhotoUrl(u?.employee?.employeePhotoUrl || getEmpPhoto(empId));
        }
        fetchEmpData(u, token);
      }
    } catch {}
  }, [fetchEmpData]);

  useEffect(() => {
    const next = readStoredEmpTheme();
    setAppearance(next);
    applyEmpTheme(next);
  }, []);

  const emp = empData || empUser?.employee || null;

  const displayName = emp
    ? `${emp.employeeFirstName || emp.firstName || ""} ${emp.employeeLastName || emp.lastName || ""}`.trim()
    : empUser?.username || "Employee";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join("") || "E";

  const designation =
    emp?.designations?.designation ||
    emp?.designations?.designationName ||
    emp?.designation ||
    null;
  const department = emp?.departments?.departmentName || emp?.department || null;

  const employeeCode = emp?.employeeID || emp?.employeeId || empUser?.username || null;
  const email = emp?.businessEmail || emp?.personalEmail || empUser?.email || empUser?.username || "—";
  const phone = emp?.businessPhoneNo || emp?.personalPhoneNo || "—";
  const joinedOn = emp?.joiningDate || null;

  const changeAppearance = (next: "light" | "dark") => {
    setAppearance(next);
    localStorage.setItem("_emp_appearance", next);
    applyEmpTheme(next);
    window.dispatchEvent(new Event("emp-theme-change"));
  };

  const handlePhotoClick = () => setShowPhotoActions(true);

  const handleChangePhotoFromActions = () => {
    setShowPhotoActions(false);
    fileInputRef.current?.click();
  };

  const handleViewPhotoFromActions = () => {
    setShowPhotoActions(false);
    setShowPhotoViewer(true);
  };

  const handleRemovePhoto = async () => {
    setShowPhotoActions(false);
    setUploadError(null);
    setUploading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const empId = empData?.id || empUser?.employee?.id || empUser?.employeeId;
      if (!empId) throw new Error("Employee not found");
      const res = await fetch(`${BACKEND}/manage-emp/${empId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeePhotoUrl: null }),
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      setImgFailed(false);
      setPhotoUrl(null);
      setEmpPhoto(empId, null);
      if (empData) {
        const next = { ...empData, employeePhotoUrl: null };
        setEmpData(next);
        setPageCache("empProfileData", next);
      }
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u.employee) u.employee.employeePhotoUrl = null;
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch {}
      window.dispatchEvent(new Event("emp-photo-updated"));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB");
      return;
    }
    setUploadError(null);
    setUploading(true);
    setImgFailed(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${BACKEND}/files/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();
      const fullUrl = url.startsWith("http") ? url : `${BACKEND}${url}`;

      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const empId = empData?.id || empUser?.employee?.id || empUser?.employeeId;
      if (empId) {
        await fetch(`${BACKEND}/manage-emp/${empId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ employeePhotoUrl: fullUrl }),
        });
      }

      setImgFailed(false);
      setPhotoUrl(fullUrl);
      setEmpPhoto(empId, fullUrl);
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u.employee) u.employee.employeePhotoUrl = fullUrl;
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch {}
      window.dispatchEvent(new Event("emp-photo-updated"));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleLogout = () => {
    const empId = empUser?.employee?.id || empUser?.employeeId;
    setEmpPhoto(empId, null);
    clearLegacyEmpPhoto();
    clearPageCache("empProfileData");
    clearPageCachesByPrefix("empNotifFeed");
    clearInAppNotifications();
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    clearActiveCompanySession();
    router.replace("/login");
  };

  return {
    fileInputRef,
    empUser,
    empData,
    uploading,
    uploadError,
    showPhotoActions,
    setShowPhotoActions,
    showPhotoViewer,
    setShowPhotoViewer,
    appearance,
    photoUrl,
    imgFailed,
    setImgFailed,
    emp,
    displayName,
    initials,
    designation,
    department,
    employeeCode,
    email,
    phone,
    joinedOn,
    changeAppearance,
    handlePhotoClick,
    handleChangePhotoFromActions,
    handleViewPhotoFromActions,
    handleRemovePhoto,
    handlePhotoChange,
    handleLogout,
  };
}
