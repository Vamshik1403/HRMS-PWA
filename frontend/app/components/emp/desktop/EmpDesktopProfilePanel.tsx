"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CreditCard,
  Fingerprint,
  Hash,
  Heart,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@iconify/react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { getPageCache, setPageCache } from "../../../utils/pageCache";
import { getEmpPhoto } from "../../../utils/empPhotoCache";
import { displayValue } from "../../../utils/display";
import { fmtJoined, useEmpProfile } from "../../../hooks/useEmpProfile";
import { cn } from "../../../utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type ProfileField = {
  label: string;
  value: unknown;
  icon: LucideIcon;
  href?: string;
};

function fmtDob(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function ProfileFieldRow({ label, value, icon: Icon, href }: ProfileField) {
  const text = displayValue(value);

  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {href && text !== "—" ? (
          <a
            href={href}
            className="mt-1 block text-sm font-medium text-primary underline-offset-2 hover:underline break-words"
          >
            {text}
          </a>
        ) : (
          <p className="mt-1 text-sm font-medium text-foreground break-words">{text}</p>
        )}
      </div>
    </div>
  );
}

function ProfileDetailSection({ title, fields }: { title: string; fields: ProfileField[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {fields.map((field) => (
          <ProfileFieldRow key={field.label} {...field} />
        ))}
      </div>
    </section>
  );
}

function ProfileHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-pulse">
      <div className="h-28 bg-muted/60" />
      <div className="px-6 pb-6">
        <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="size-28 rounded-full bg-muted ring-4 ring-card" />
          <div className="flex-1 space-y-3 pb-1">
            <div className="h-7 w-48 rounded-lg bg-muted" />
            <div className="h-4 w-64 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-muted" />
              <div className="h-6 w-28 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmpDesktopProfilePanel({
  embedded = false,
  employeeId: viewEmployeeId,
  readOnly = false,
}: {
  embedded?: boolean;
  employeeId?: number;
  readOnly?: boolean;
}) {
  const photoProfile = useEmpProfile();
  const [empUser, setEmpUser] = useState<any>(null);
  const [empData, setEmpData] = useState<any>(() =>
    viewEmployeeId ? null : getPageCache("empProfileData"),
  );
  const [loading, setLoading] = useState(viewEmployeeId ? true : !empData);

  const fetchEmpData = useCallback(
    async (u: any, token: string, targetId?: number) => {
      try {
        const empId = targetId ?? u?.employee?.id ?? u?.employeeId ?? u?.id;
        if (!empId) return;
        const res = await fetch(`${BACKEND}/manage-emp/${empId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setEmpData(data);
        if (!targetId) setPageCache("empProfileData", data);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      if (viewEmployeeId) {
        if (token) void fetchEmpData(null, token, viewEmployeeId);
        else setLoading(false);
        return;
      }
      const s = localStorage.getItem("user");
      if (s) {
        const u = JSON.parse(s);
        setEmpUser(u);
        if (token) void fetchEmpData(u, token);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [fetchEmpData, viewEmployeeId]);

  const emp = empData || empUser?.employee || null;
  const empId = emp?.id || empUser?.employee?.id;

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

  const photoUrl =
    (readOnly || viewEmployeeId ? emp?.employeePhotoUrl : null) ||
    photoProfile.photoUrl ||
    emp?.employeePhotoUrl ||
    getEmpPhoto(empId) ||
    null;
  const designation =
    emp?.designations?.designation ||
    emp?.designations?.designationName ||
    emp?.designation ||
    null;
  const department = emp?.departments?.departmentName || emp?.department || null;
  const employeeCode = emp?.employeeID || emp?.employeeId || empUser?.username || null;
  const personalEmail = emp?.personalEmail || null;
  const personalPhone = emp?.personalPhoneNo || null;
  const officialEmail = emp?.businessEmail || null;
  const officialPhone = emp?.businessPhoneNo || null;
  const joinedOn = emp?.joiningDate;
  const workShiftName =
    emp?.empWorkShift?.[0]?.workShift?.workShiftName ||
    emp?.workShift?.workShiftName ||
    null;
  const branchName =
    emp?.empBranch?.[0]?.branch?.branchName || emp?.branches?.branchName || null;

  const subtitleParts = [designation, department].filter(Boolean);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

  const identityFields: ProfileField[] = [
    { label: "Aadhaar number", value: emp?.aadharNo, icon: Fingerprint },
    { label: "PAN number", value: emp?.panNo, icon: CreditCard },
    { label: "UAN number", value: emp?.uanNo, icon: Hash },
    { label: "ESI number", value: emp?.esiNo, icon: Hash },
    { label: "PF number", value: emp?.pfNumber, icon: Hash },
  ];

  const personalFields: ProfileField[] = [
    { label: "Gender", value: emp?.gender, icon: User },
    { label: "Date of birth", value: fmtDob(emp?.dateOfBirth), icon: Calendar },
    { label: "Blood group", value: emp?.bloodGroup, icon: Heart },
    { label: "Marital status", value: emp?.maritalStatus, icon: Users },
    { label: "Father's name", value: emp?.employeeFatherName, icon: User },
    { label: "Mother's name", value: emp?.employeeMotherName, icon: User },
    { label: "Spouse name", value: emp?.employeeSpouseName, icon: User },
  ];

  const employeeInfoFields: ProfileField[] = [
    { label: "Employment type", value: emp?.employmentType, icon: Briefcase },
    { label: "Employment status", value: emp?.employmentStatus, icon: Briefcase },
    { label: "Employee type", value: emp?.empType || emp?.typeOfEmployee, icon: User },
    { label: "Lifecycle status", value: emp?.lifecycleStatus, icon: Briefcase },
    { label: "Probation period", value: emp?.probationPeriod, icon: Calendar },
    { label: "Joined on", value: fmtJoined(joinedOn), icon: Calendar },
  ];

  const workFields: ProfileField[] = [
    { label: "Employee ID", value: employeeCode, icon: Hash },
    { label: "Department", value: department, icon: Building2 },
    { label: "Designation", value: designation, icon: Briefcase },
    { label: "Branch", value: branchName, icon: Building2 },
    { label: "Work shift", value: workShiftName, icon: Calendar },
  ];

  const personalContactFields: ProfileField[] = [
    {
      label: "Personal email",
      value: personalEmail,
      icon: Mail,
      href: personalEmail ? `mailto:${personalEmail}` : undefined,
    },
    {
      label: "Personal phone",
      value: personalPhone,
      icon: Phone,
      href: personalPhone ? `tel:${personalPhone}` : undefined,
    },
  ];

  const officialContactFields: ProfileField[] = [
    {
      label: "Official email",
      value: officialEmail,
      icon: Mail,
      href: officialEmail ? `mailto:${officialEmail}` : undefined,
    },
    {
      label: "Official phone",
      value: officialPhone,
      icon: Phone,
      href: officialPhone ? `tel:${officialPhone}` : undefined,
    },
  ];

  const body = (
    <div className="space-y-6">
      {loading ? (
        <ProfileHeroSkeleton />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-primary/15 via-primary/8 to-transparent" />
          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                {readOnly ? (
                  <div
                    className={cn(
                      "relative size-28 shrink-0 overflow-hidden rounded-full bg-primary ring-4 ring-card shadow-md",
                      "flex items-center justify-center",
                    )}
                  >
                    {photoUrl && !photoProfile.imgFailed ? (
                      <img
                        src={photoUrl}
                        alt={displayName}
                        className="size-full object-cover"
                        onError={() => photoProfile.setImgFailed(true)}
                      />
                    ) : (
                      <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={photoProfile.handlePhotoClick}
                    className={cn(
                      "group relative size-28 shrink-0 overflow-hidden rounded-full bg-primary ring-4 ring-card shadow-md",
                      "flex items-center justify-center transition-transform hover:scale-[1.02]",
                    )}
                    title="Change profile photo"
                  >
                    {photoUrl && !photoProfile.imgFailed ? (
                      <img
                        src={photoUrl}
                        alt={displayName}
                        className="size-full object-cover"
                        onError={() => photoProfile.setImgFailed(true)}
                      />
                    ) : (
                      <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
                    )}
                    {photoProfile.uploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Icon icon="solar:refresh-bold-duotone" className="size-6 animate-spin text-white" />
                      </div>
                    ) : (
                      <div className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="size-4 text-white" />
                      </div>
                    )}
                  </button>
                )}

                <div className="min-w-0 pb-1">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                    {displayName}
                  </h2>
                  {subtitle ? (
                    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Employee profile</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {employeeCode ? (
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        ID {employeeCode}
                      </Badge>
                    ) : null}
                    {joinedOn ? (
                      <Badge variant="outline" className="text-[11px]">
                        Joined {fmtJoined(joinedOn)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={photoProfile.handlePhotoClick}
                >
                  <Camera className="size-4" />
                  Change photo
                </Button>
              ) : null}
            </div>

            {!readOnly && photoProfile.uploadError ? (
              <p className="mt-4 text-sm text-destructive">{photoProfile.uploadError}</p>
            ) : null}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Identity information" fields={identityFields} />
        <ProfileDetailSection title="Personal details" fields={personalFields} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Employee information" fields={employeeInfoFields} />
        <ProfileDetailSection title="Work details" fields={workFields} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Personal contact" fields={personalContactFields} />
        <ProfileDetailSection title="Official contact" fields={officialContactFields} />
      </div>
    </div>
  );

  const photoDialogs = readOnly ? null : (
    <>
      <input
        ref={photoProfile.fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={photoProfile.handlePhotoChange}
      />
      <Dialog open={photoProfile.showPhotoActions} onOpenChange={photoProfile.setShowPhotoActions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {photoUrl && !photoProfile.imgFailed ? (
              <Button variant="outline" className="w-full justify-start" onClick={photoProfile.handleViewPhotoFromActions}>
                View profile picture
              </Button>
            ) : null}
            <Button variant="outline" className="w-full justify-start" onClick={photoProfile.handleChangePhotoFromActions}>
              <Camera className="size-4" />
              Change image
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={photoProfile.showPhotoViewer} onOpenChange={photoProfile.setShowPhotoViewer}>
        <DialogContent className="border-none bg-black/95 p-2 sm:max-w-2xl">
          {photoUrl && !photoProfile.imgFailed ? (
            <img
              src={photoUrl}
              alt={`${displayName} profile`}
              className="max-h-[80vh] w-full rounded-lg object-contain"
              onError={() => photoProfile.setImgFailed(true)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return (
      <>
        {body}
        {photoDialogs}
      </>
    );
  }

  return (
    <EmpDesktopPage title="Profile" description="Your employee information" icon={User}>
      {body}
      {photoDialogs}
    </EmpDesktopPage>
  );
}
