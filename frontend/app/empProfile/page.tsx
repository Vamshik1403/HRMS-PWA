"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const APP_VERSION = "v1.0.0";

function fmtJoined(dateStr: string | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

export default function EmpProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empUser, setEmpUser] = useState<any>(null);
  const [empData, setEmpData] = useState<any>(() => getPageCache<any>("empProfileData"));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    const cached = getPageCache<any>("empProfileData");
    return cached?.employeePhotoUrl || (typeof window !== "undefined" ? localStorage.getItem("_emp_photo") : null);
  });
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
      if (data?.employeePhotoUrl) {
        setPhotoUrl(data.employeePhotoUrl);
        setImgFailed(false);
        // Cache so home dashboard shows it immediately on next visit
        try { localStorage.setItem("_emp_photo", data.employeePhotoUrl); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem("user");
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      if (s) {
        const u = JSON.parse(s);
        setEmpUser(u);
        // Only fall back to stored user photo if we have no better cache
        const storedPhoto = u?.employee?.employeePhotoUrl;
        if (storedPhoto) setPhotoUrl((prev) => prev || storedPhoto);
        fetchEmpData(u, token);
      }
    } catch {}
  }, [fetchEmpData]);

  const emp = empData || empUser?.employee || null;

  const displayName = emp
    ? `${emp.employeeFirstName || emp.firstName || ""} ${emp.employeeLastName || emp.lastName || ""}`.trim()
    : empUser?.username || "Employee";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("") || "E";

  const designation = emp?.designations?.designationName || emp?.designation || null;
  const department = emp?.departments?.departmentName || emp?.department || null;
  const designationLine = [designation, department].filter(Boolean).join(" · ");

  const employeeCode = emp?.employeeID || emp?.employeeId || empUser?.username || null;
  const email = emp?.businessEmail || emp?.personalEmail || empUser?.email || empUser?.username || "—";
  const phone = emp?.businessPhoneNo || emp?.personalPhoneNo || "—";
  const joinedOn = emp?.joiningDate || null;

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image must be under 5MB"); return; }
    setUploadError(null);
    setUploading(true);
    setImgFailed(false);
    try {
      // Upload to /backend/files/upload
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${BACKEND}/files/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();
      // url is like "/uploads/filename" — construct full URL via backend proxy
      const fullUrl = url.startsWith("http") ? url : `${BACKEND}${url}`;

      // Save to employee record
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
      try { localStorage.setItem("_emp_photo", fullUrl); } catch {};
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u.employee) u.employee.employeePhotoUrl = fullUrl;
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch {}
    } catch (e: any) {
      setUploadError(e.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-6">
        {/* Title */}
        <h1 className="text-[22px] font-bold text-gray-900 mb-5">Profile</h1>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 flex flex-col items-center">
          {/* Photo */}
          <div className="relative mb-3">
            <button
              onClick={handlePhotoClick}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-[#2563eb] flex items-center justify-center shadow-md active:scale-[0.97] transition-transform"
              title="Tap to change photo"
            >
              {photoUrl && !imgFailed ? (
                <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
              ) : (
                <span className="text-white font-bold text-2xl">{initials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {/* Camera overlay */}
              <div className="absolute bottom-0 inset-x-0 h-7 bg-black/30 flex items-center justify-center">
                <Icon icon="solar:camera-bold" className="w-4 h-4 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          {uploadError && <p className="text-[11px] text-red-500 mb-2">{uploadError}</p>}

          {/* Name & designation */}
          <h2 className="text-[18px] font-bold text-gray-900">{displayName}</h2>
          {designationLine && (
            <p className="text-[13px] text-gray-500 mt-0.5">{designationLine}</p>
          )}
          {employeeCode && (
            <div className="mt-2 flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-1">
              <Icon icon="solar:card-bold-duotone" className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[12px] font-semibold text-gray-600">{employeeCode}</span>
            </div>
          )}
        </div>

        {/* Info rows */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          {[
            { icon: "solar:letter-bold-duotone",  label: "Email",     value: email },
            { icon: "solar:phone-bold-duotone",   label: "Phone",     value: phone },
            { icon: "solar:calendar-bold-duotone", label: "Joined On", value: fmtJoined(joinedOn) },
          ].map((row, i, arr) => (
            <div key={row.label} className={`flex items-center gap-3 px-4 py-4 ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`}>
              <Icon icon={row.icon} className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-[13px] text-gray-500 w-20 shrink-0">{row.label}</span>
              <span className="text-[13px] font-bold text-gray-900 flex-1 text-right truncate">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Log out */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-[15px] shadow-md shadow-red-100 active:scale-[0.98] transition-transform mb-4"
        >
          Log out
        </button>

        {/* Version */}
        <p className="text-center text-[12px] text-gray-400">OpenHRM Mobile · {APP_VERSION}</p>
      </div>
    </EmpMobileLayout>
  );
}
