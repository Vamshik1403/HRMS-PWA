"use client";

import {
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Hash,
  LogOut,
  Mail,
  Palette,
  Phone,
  User,
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
import { displayValue } from "../../../utils/display";
import { fmtJoined, useEmpProfile } from "../../../hooks/useEmpProfile";
import { cn } from "../../../utils/cn";

const APP_VERSION = "v1.0.0";

type ProfileField = {
  label: string;
  value: unknown;
  icon: LucideIcon;
  href?: string;
};

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

export function EmpDesktopProfilePage() {
  const profile = useEmpProfile();
  const {
    fileInputRef,
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
    handlePhotoChange,
    handleLogout,
  } = profile;

  const subtitleParts = [designation, department].filter((v) => v && v !== "—");
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

  const contactFields: ProfileField[] = [
    {
      label: "Email",
      value: email,
      icon: Mail,
      href: email && email !== "—" ? `mailto:${email}` : undefined,
    },
    {
      label: "Phone",
      value: phone,
      icon: Phone,
      href: phone && phone !== "—" ? `tel:${phone}` : undefined,
    },
    { label: "Joined on", value: fmtJoined(joinedOn), icon: Calendar },
  ];

  const workFields: ProfileField[] = [
    { label: "Employee ID", value: employeeCode, icon: Hash },
    { label: "Department", value: department, icon: Building2 },
    { label: "Designation", value: designation, icon: Briefcase },
  ];

  return (
    <EmpDesktopPage title="Profile" description="Manage your account and preferences" icon={User}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-primary/15 via-primary/8 to-transparent" />
          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  className={cn(
                    "group relative size-28 shrink-0 overflow-hidden rounded-full bg-primary ring-4 ring-card shadow-md",
                    "flex items-center justify-center transition-transform hover:scale-[1.02]",
                  )}
                  title="Change profile photo"
                >
                  {photoUrl && !imgFailed ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      className="size-full object-cover"
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
                  )}
                  {uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Icon icon="solar:refresh-bold-duotone" className="size-6 animate-spin text-white" />
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="size-4 text-white" />
                    </div>
                  )}
                </button>

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
                    {employeeCode && employeeCode !== "—" ? (
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

              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={handlePhotoClick}>
                <Camera className="size-4" />
                Change photo
              </Button>
            </div>

            {uploadError ? <p className="mt-4 text-sm text-destructive">{uploadError}</p> : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileDetailSection title="Work details" fields={workFields} />
          <ProfileDetailSection title="Contact" fields={contactFields} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-display text-base font-semibold text-foreground">Preferences</h3>
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted/80">
                  <Palette className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Appearance</p>
                  <p className="text-xs text-muted-foreground">Choose light or dark theme</p>
                </div>
              </div>
              <div className="inline-flex rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => changeAppearance("light")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    appearance === "light"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => changeAppearance("dark")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    appearance === "dark"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-foreground">Sign out</p>
              <p className="mt-0.5 text-xs text-muted-foreground">End your session on this device</p>
            </div>
            <Button variant="destructive" onClick={handleLogout} className="shrink-0">
              <LogOut className="size-4" />
              Log out
            </Button>
          </section>
        </div>

        <p className="text-xs text-muted-foreground">OpenHRM · {APP_VERSION}</p>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      <Dialog open={showPhotoActions} onOpenChange={setShowPhotoActions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {photoUrl && !imgFailed ? (
              <Button variant="outline" className="w-full justify-start" onClick={handleViewPhotoFromActions}>
                View profile picture
              </Button>
            ) : null}
            <Button variant="outline" className="w-full justify-start" onClick={handleChangePhotoFromActions}>
              <Camera className="size-4" />
              Change image
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPhotoViewer} onOpenChange={setShowPhotoViewer}>
        <DialogContent className="border-none bg-black/95 p-2 sm:max-w-2xl">
          {photoUrl && !imgFailed ? (
            <img
              src={photoUrl}
              alt={`${displayName} profile`}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </EmpDesktopPage>
  );
}
