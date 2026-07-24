"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Camera,
  CreditCard,
  Fingerprint,
  GraduationCap,
  Hash,
  Heart,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User,
  UserCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@iconify/react";
import { EmpDesktopPage } from "./EmpDesktopPage";
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

function ProfileRepeaterSection({
  title,
  emptyMessage,
  children,
}: {
  title: string;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5eeff] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
      <div className="border-b border-[#e5eeff] px-6 py-4">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children ?? (
        <p className="px-6 py-8 text-sm text-muted-foreground text-center">{emptyMessage}</p>
      )}
    </section>
  );
}

function resolvePolicyName(
  emp: any,
  directKey: "attendancePolicy" | "leavePolicy",
  historyKey: "empAttendancePolicy" | "empLeavePolicy",
  policyField: "attendancePolicy" | "leavePolicy",
  nameField: "attendancePolicyName" | "leavePolicyName",
) {
  const direct = emp?.[directKey]?.[nameField];
  if (direct) return direct;

  const fromHistory = emp?.[historyKey]?.[0]?.[policyField]?.[nameField];
  if (fromHistory) return fromHistory;

  const fromPromotion = emp?.empPromotion?.[0]?.[policyField]?.[nameField];
  if (fromPromotion) return fromPromotion;

  return null;
}

function ProfileDetailSection({ title, fields }: { title: string; fields: ProfileField[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5eeff] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
      <div className="border-b border-[#e5eeff] px-6 py-4">
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
    <div className="animate-pulse rounded-[20px] border border-black/[0.06] bg-white p-8 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="flex gap-5">
          <div className="size-[88px] rounded-full bg-muted" />
          <div className="space-y-3 pt-1">
            <div className="h-8 w-52 rounded-lg bg-muted" />
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-muted" />
              <div className="h-6 w-28 rounded-full bg-muted" />
            </div>
          </div>
        </div>
        <div className="hidden lg:block h-[120px] w-px bg-muted" />
        <div className="grid flex-1 grid-cols-2 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-9 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block h-11 w-36 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function HeroInfoItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: unknown;
  href?: string;
}) {
  const text = displayValue(value);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
        <Icon className="size-4 text-[#6B7280]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
        {href && text !== "—" ? (
          <a
            href={href}
            className="mt-0.5 block truncate text-[15px] font-medium text-[#111827] hover:text-[#3B82F6]"
          >
            {text}
          </a>
        ) : (
          <p className="mt-0.5 truncate text-[15px] font-medium text-[#111827]">{text}</p>
        )}
      </div>
    </div>
  );
}

function ProfileAvatar({
  displayName,
  initials,
  photoUrl,
  imgFailed,
  setImgFailed,
  readOnly,
  uploading,
  onPhotoClick,
}: {
  displayName: string;
  initials: string;
  photoUrl: string | null;
  imgFailed: boolean;
  setImgFailed: (v: boolean) => void;
  readOnly: boolean;
  uploading?: boolean;
  onPhotoClick?: () => void;
}) {
  const avatarBody = (
    <>
      {photoUrl && !imgFailed ? (
        <img
          src={photoUrl}
          alt={displayName}
          className="size-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-2xl font-bold text-white">{initials}</span>
      )}
      {uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Icon icon="solar:refresh-bold-duotone" className="size-6 animate-spin text-white" />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="relative shrink-0">
      {readOnly ? (
        <div
          className={cn(
            "flex size-[88px] items-center justify-center overflow-hidden rounded-full shadow-sm",
            photoUrl && !imgFailed
              ? "bg-muted"
              : "bg-gradient-to-br from-[#3B82F6] to-[#2563EB]",
          )}
        >
          {avatarBody}
        </div>
      ) : (
        <button
          type="button"
          onClick={onPhotoClick}
          className={cn(
            "group relative flex size-[88px] items-center justify-center overflow-hidden rounded-full shadow-sm transition-transform hover:scale-[1.02]",
            photoUrl && !imgFailed
              ? "bg-muted"
              : "bg-gradient-to-br from-[#3B82F6] to-[#2563EB]",
          )}
          title="Change profile photo"
        >
          {avatarBody}
        </button>
      )}

      <span
        className="absolute bottom-2 right-2 z-10 size-3 rounded-full border-2 border-white bg-emerald-500"
        title="Active"
        aria-hidden
      />

      {!readOnly && !uploading ? (
        <button
          type="button"
          onClick={onPhotoClick}
          className="absolute -bottom-0.5 -right-0.5 z-20 flex size-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-md transition-colors hover:border-[#3B82F6] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
          title="Change profile photo"
        >
          <Camera className="size-3.5" />
        </button>
      ) : null}
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
  const [viewPhotoFailed, setViewPhotoFailed] = useState(false);
  const [reportingManager, setReportingManager] = useState<string | null>(null);

  const isViewingOther = viewEmployeeId != null;

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
    if (!viewEmployeeId) return;
    setEmpData(null);
    setLoading(true);
    setViewPhotoFailed(false);
  }, [viewEmployeeId]);

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

  useEffect(() => {
    setViewPhotoFailed(false);
  }, [viewEmployeeId, empData?.employeePhotoUrl]);

  useEffect(() => {
    const targetId = viewEmployeeId ?? empData?.id ?? empUser?.employee?.id;
    if (!targetId) {
      setReportingManager(null);
      return;
    }
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) return;

    fetch(`${BACKEND}/manage-emp/${targetId}/linked-employees`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((managers: { employeeFirstName?: string; employeeLastName?: string }[]) => {
        if (!Array.isArray(managers) || managers.length === 0) {
          setReportingManager(null);
          return;
        }
        const primary = managers[0];
        const name = [primary.employeeFirstName, primary.employeeLastName].filter(Boolean).join(" ").trim();
        setReportingManager(name || null);
      })
      .catch(() => setReportingManager(null));
  }, [viewEmployeeId, empData?.id, empUser?.employee?.id]);

  const emp = isViewingOther ? empData : empData || empUser?.employee || null;
  const empId = isViewingOther ? viewEmployeeId : emp?.id || empUser?.employee?.id;

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

  const photoUrl = isViewingOther
    ? empData?.employeePhotoUrl || null
    : photoProfile.photoUrl || emp?.employeePhotoUrl || getEmpPhoto(String(empId)) || null;
  const imgFailed = isViewingOther ? viewPhotoFailed : photoProfile.imgFailed;
  const setImgFailed = isViewingOther ? setViewPhotoFailed : photoProfile.setImgFailed;
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
  const officeLocation = branchName || emp?.presentAddress || emp?.permenantAddress || null;
  const workEmail = officialEmail || personalEmail;
  const phoneNumber = officialPhone || personalPhone;
  const employmentType = emp?.employmentType || emp?.empType || emp?.typeOfEmployee || null;
  const roleSubtitle = designation || department || "Employee";

  const heroInfoItems: {
    icon: LucideIcon;
    label: string;
    value: unknown;
    href?: string;
  }[] = [
    { icon: Briefcase, label: "Employee type", value: employmentType },
    { icon: Building2, label: "Department", value: department },
    { icon: MapPin, label: "Office location", value: officeLocation },
    {
      icon: Phone,
      label: "Phone number",
      value: phoneNumber,
      href: phoneNumber ? `tel:${phoneNumber}` : undefined,
    },
    {
      icon: Mail,
      label: "Work email",
      value: workEmail,
      href: workEmail ? `mailto:${workEmail}` : undefined,
    },
    { icon: UserCircle, label: "Reporting manager", value: reportingManager },
  ];

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
    {
      label: "Attendance policy",
      value: resolvePolicyName(
        emp,
        "attendancePolicy",
        "empAttendancePolicy",
        "attendancePolicy",
        "attendancePolicyName",
      ),
      icon: Calendar,
    },
    {
      label: "Leave policy",
      value: resolvePolicyName(emp, "leavePolicy", "empLeavePolicy", "leavePolicy", "leavePolicyName"),
      icon: Calendar,
    },
  ];

  const educationRows = Array.isArray(emp?.empEduQualification) ? emp.empEduQualification : [];
  const experienceRows = Array.isArray(emp?.empProfExprience) ? emp.empProfExprience : [];
  const bankRows = Array.isArray(emp?.employeeBankDetails) ? emp.employeeBankDetails : [];
  const primaryBank = bankRows[0];

  const nomineeFields: ProfileField[] = [
    { label: "Nominee name", value: emp?.employeeSpouseName, icon: User },
    { label: "Relationship", value: emp?.employeeSpouseName ? "Spouse" : null, icon: Users },
    { label: "Emergency contact", value: emp?.emergancyContact, icon: Phone },
    { label: "Bank name", value: primaryBank?.bankName, icon: Building2 },
    { label: "Account number", value: primaryBank?.accNumber, icon: CreditCard },
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
        <section className="rounded-[20px] border border-[#e5eeff] bg-white p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-center">
            <div className="flex min-w-0 shrink-0 items-center gap-5">
              <ProfileAvatar
                displayName={displayName}
                initials={initials}
                photoUrl={photoUrl}
                imgFailed={imgFailed}
                setImgFailed={setImgFailed}
                readOnly={readOnly}
                uploading={!readOnly ? photoProfile.uploading : false}
                onPhotoClick={readOnly ? undefined : photoProfile.handlePhotoClick}
              />

              <div className="min-w-0">
                <h2 className="truncate text-[30px] font-bold leading-tight tracking-tight text-[#111827]">
                  {displayName}
                </h2>
                <p className="mt-1 truncate text-base font-medium text-[#6B7280]">{roleSubtitle}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {employeeCode ? (
                    <span className="inline-flex items-center rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#3B82F6]">
                      ID {employeeCode}
                    </span>
                  ) : null}
                  {joinedOn ? (
                    <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-[#6B7280]">
                      Joined {fmtJoined(joinedOn)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="hidden h-[120px] w-px shrink-0 bg-[#E5E7EB] xl:block" aria-hidden />

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
              {heroInfoItems.map((item) => (
                <HeroInfoItem key={item.label} {...item} />
              ))}
            </div>
          </div>

          {!readOnly && photoProfile.uploadError ? (
            <p className="mt-4 text-sm text-destructive">{photoProfile.uploadError}</p>
          ) : null}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Work details" fields={workFields} />
        <ProfileDetailSection title="Employee information" fields={employeeInfoFields} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Official contact" fields={officialContactFields} />
        <ProfileRepeaterSection title="Work experience" emptyMessage="No work experience on file.">
          {experienceRows.length > 0 ? (
            <div className="divide-y divide-border">
              {experienceRows.map((exp: Record<string, string | null | undefined>, index: number) => (
                <div key={exp.id ?? index} className="px-6 py-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80">
                      <Briefcase className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {[exp.designation, exp.orgName].filter(Boolean).join(" at ") || "Experience"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[exp.fromDate, exp.toDate].filter(Boolean).join(" – ") || "—"}
                      </p>
                      {exp.responsibility ? (
                        <p className="text-sm text-foreground mt-2">{exp.responsibility}</p>
                      ) : null}
                      {exp.skill ? (
                        <p className="text-xs text-muted-foreground mt-1">Skills: {exp.skill}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </ProfileRepeaterSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileRepeaterSection title="Education" emptyMessage="No education details on file.">
          {educationRows.length > 0 ? (
            <div className="divide-y divide-border">
              {educationRows.map((edu: Record<string, string | null | undefined>, index: number) => (
                <div key={edu.id ?? index} className="px-6 py-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80">
                      <GraduationCap className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {[edu.degree, edu.instituteName].filter(Boolean).join(" · ") || "Education"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[edu.instituteType, edu.pasingYear, edu.marks ? `Marks ${edu.marks}` : null, edu.gpaCgpa ? `GPA ${edu.gpaCgpa}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </ProfileRepeaterSection>
        <ProfileDetailSection title="Nominee details" fields={nomineeFields} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Identity information" fields={identityFields} />
        <ProfileDetailSection title="Personal details" fields={personalFields} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileDetailSection title="Personal contact" fields={personalContactFields} />
        <ProfileDetailSection
          title="Address"
          fields={[
            { label: "Present address", value: emp?.presentAddress, icon: MapPin },
            { label: "Permanent address", value: emp?.permenantAddress, icon: MapPin },
          ]}
        />
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
            {photoUrl && !imgFailed ? (
              <Button variant="outline" className="w-full justify-start" onClick={photoProfile.handleViewPhotoFromActions}>
                View profile picture
              </Button>
            ) : null}
            <Button variant="outline" className="w-full justify-start" onClick={photoProfile.handleChangePhotoFromActions}>
              <Camera className="size-4" />
              Change image
            </Button>
            {photoUrl && !imgFailed ? (
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => void photoProfile.handleRemovePhoto()}
                disabled={photoProfile.uploading}
              >
                <Trash2 className="size-4" />
                Remove profile picture
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={photoProfile.showPhotoViewer} onOpenChange={photoProfile.setShowPhotoViewer}>
        <DialogContent className="border-none bg-black/95 p-2 sm:max-w-2xl">
          {photoUrl && !imgFailed ? (
            <img
              src={photoUrl}
              alt={`${displayName} profile`}
              className="max-h-[80vh] w-full rounded-lg object-contain"
              onError={() => setImgFailed(true)}
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
