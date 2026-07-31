"use client";

import { Camera, LogOut, Mail, Phone, Calendar, Palette, BadgeCheck } from "lucide-react";
import { Icon } from "@iconify/react";
import { fmtJoined, useEmpProfile } from "@/app/hooks/useEmpProfile";
import { cn } from "@/app/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

const APP_VERSION = "v1.0.0";

/**
 * Simple mobile/PWA profile — avatar, details, appearance, logout.
 * No desktop-style workspace tabs.
 */
export function EmpMobileSimpleProfile() {
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
    handleRemovePhoto,
    handlePhotoChange,
    handleLogout,
  } = profile;

  const rows = [
    {
      key: "email",
      label: "Email",
      value: email && email !== "—" ? email : "—",
      icon: Mail,
      href: email && email !== "—" ? `mailto:${email}` : undefined,
    },
    {
      key: "phone",
      label: "Phone",
      value: phone && phone !== "—" ? String(phone) : "—",
      icon: Phone,
      href: phone && phone !== "—" ? `tel:${phone}` : undefined,
    },
    {
      key: "joined",
      label: "Joined On",
      value: fmtJoined(joinedOn || undefined),
      icon: Calendar,
    },
  ];

  return (
    <div className="px-4 pt-5 pb-8 space-y-4">
      <h1 className="text-[22px] font-bold text-foreground tracking-tight">Profile</h1>

      {/* Identity card — camera badge sits outside avatar clip */}
      <section className="rounded-2xl border border-border bg-card shadow-sm px-5 pt-6 pb-5 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={handlePhotoClick}
          className="relative size-[88px] shrink-0"
          title="Change profile photo"
        >
          <span
            className={cn(
              "flex size-full items-center justify-center overflow-hidden rounded-full shadow-md",
              photoUrl && !imgFailed ? "bg-muted" : "bg-primary",
            )}
          >
            {photoUrl && !imgFailed ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="size-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
            )}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Icon icon="solar:refresh-bold-duotone" className="size-5 animate-spin text-white" />
              </span>
            ) : null}
          </span>
          {!uploading ? (
            <span className="absolute -bottom-0.5 -right-0.5 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-white shadow">
              <Camera className="size-3.5 text-muted-foreground" />
            </span>
          ) : null}
        </button>

        <p className="mt-4 text-[17px] font-bold uppercase tracking-wide text-foreground">
          {displayName}
        </p>
        {department && department !== "—" ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{department}</p>
        ) : null}
        {designation && designation !== "—" ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{designation}</p>
        ) : null}

        {employeeCode && employeeCode !== "—" ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <BadgeCheck className="size-3.5" />
            {employeeCode}
          </div>
        ) : null}

        {uploadError ? <p className="mt-3 text-sm text-destructive">{uploadError}</p> : null}
      </section>

      {/* Details + appearance */}
      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
        {rows.map((row) => {
          const RowIcon = row.icon;
          const valueNode =
            row.href && row.value !== "—" ? (
              <a href={row.href} className="text-[14px] font-semibold text-foreground break-all">
                {row.value}
              </a>
            ) : (
              <span className="text-[14px] font-semibold text-foreground break-all">{row.value}</span>
            );
          return (
            <div key={row.key} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80">
                <RowIcon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted-foreground shrink-0">{row.label}</span>
                <div className="min-w-0 text-right">{valueNode}</div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80">
            <Palette className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">Appearance</span>
            <div className="inline-flex rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => changeAppearance("light")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  appearance === "light"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => changeAppearance("dark")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  appearance === "dark"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full h-12 rounded-2xl bg-red-500 text-white font-semibold text-[15px] shadow-sm active:opacity-90 flex items-center justify-center gap-2"
      >
        <LogOut className="size-4" />
        Log out
      </button>

      <p className="text-center text-[11px] text-muted-foreground pt-1">
        OpenHRM Mobile - {APP_VERSION}
      </p>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      <Dialog open={showPhotoActions} onOpenChange={setShowPhotoActions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {photoUrl && !imgFailed ? (
              <button
                type="button"
                className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium"
                onClick={handleViewPhotoFromActions}
              >
                View profile picture
              </button>
            ) : null}
            <button
              type="button"
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium flex items-center gap-2"
              onClick={handleChangePhotoFromActions}
            >
              <Camera className="size-4" />
              Change image
            </button>
            {photoUrl && !imgFailed ? (
              <button
                type="button"
                className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-destructive"
                onClick={() => void handleRemovePhoto()}
                disabled={uploading}
              >
                Remove profile picture
              </button>
            ) : null}
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
    </div>
  );
}
