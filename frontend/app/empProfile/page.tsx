"use client";

import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopMyProfileWorkspace } from "../components/emp/desktop/EmpDesktopMyProfileWorkspace";
import { fmtJoined, useEmpProfile } from "../hooks/useEmpProfile";

const APP_VERSION = "v1.0.0";

function EmpProfileMobileContent() {
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
  } = useEmpProfile();

  return (
    <>
      <div className="px-4 pt-6 pb-6">
        <h1 className="text-[22px] font-bold text-gray-900 mb-5">Profile</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 flex flex-col items-center">
          <div className="relative mb-3">
            <button
              onClick={handlePhotoClick}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-[#2563eb] flex items-center justify-center shadow-md active:scale-[0.97] transition-transform"
              title="Tap to change photo"
            >
              {photoUrl && !imgFailed ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <span className="text-white font-bold text-2xl">{initials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
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

          <h2 className="text-[18px] font-bold text-gray-900">{displayName}</h2>
          {department && <p className="text-[13px] text-gray-500 mt-0.5">{department}</p>}
          {designation && <p className="text-[13px] text-gray-500 mt-0.5">{designation}</p>}
          {employeeCode && (
            <div className="mt-2 flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-1">
              <Icon icon="solar:card-bold-duotone" className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[12px] font-semibold text-gray-600">{employeeCode}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          {[
            { icon: "solar:letter-bold-duotone", label: "Email", value: email },
            { icon: "solar:phone-bold-duotone", label: "Phone", value: phone },
            { icon: "solar:calendar-bold-duotone", label: "Joined On", value: fmtJoined(joinedOn) },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex items-center gap-3 px-4 py-4 ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`}
            >
              <Icon icon={row.icon} className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-[13px] text-gray-500 w-20 shrink-0">{row.label}</span>
              <span className="text-[13px] font-bold text-gray-900 flex-1 text-right truncate">{row.value}</span>
            </div>
          ))}

          <div className="flex items-center gap-3 px-4 py-4 border-t border-gray-50">
            <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="text-[13px] text-gray-500 w-20 shrink-0">Appearance</span>
            <div className="ml-auto inline-flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => changeAppearance("light")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${appearance === "light" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => changeAppearance("dark")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${appearance === "dark" ? "bg-[#1f2937] text-white shadow-sm" : "text-gray-500"}`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-[15px] shadow-md shadow-red-100 active:scale-[0.98] transition-transform mb-4"
        >
          Log out
        </button>

        <p className="text-center text-[12px] text-gray-400">OpenHRM Mobile · {APP_VERSION}</p>
      </div>

      {showPhotoActions && (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-[2px] flex items-end pb-[calc(env(safe-area-inset-bottom)+84px)]"
          onClick={() => setShowPhotoActions(false)}
        >
          <div
            className="w-full bg-white rounded-t-[28px] px-4 pt-3 pb-4 shadow-[0_-14px_40px_rgba(15,23,42,0.24)] max-h-[72vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 mb-3" />

            <div className="flex items-center gap-3 px-1 pb-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2563eb] flex items-center justify-center shrink-0">
                {photoUrl && !imgFailed ? (
                  <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900">Profile picture</p>
                <p className="text-xs text-slate-500 truncate">Manage how your photo appears in the app</p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {photoUrl && !imgFailed && (
                <button
                  type="button"
                  onClick={handleViewPhotoFromActions}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.995]"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Icon icon="solar:eye-bold-duotone" className="w-5 h-5 text-slate-700" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">View profile picture</span>
                        <span className="block text-xs text-slate-500">Open photo in full screen</span>
                      </span>
                    </span>
                    <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-slate-400" />
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleChangePhotoFromActions}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.995]"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon icon="solar:camera-bold-duotone" className="w-5 h-5 text-blue-700" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">Change image</span>
                      <span className="block text-xs text-slate-500">Upload a new profile photo</span>
                    </span>
                  </span>
                  <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-slate-400" />
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPhotoActions(false)}
              className="mt-4 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showPhotoViewer && photoUrl && !imgFailed && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowPhotoViewer(false)}
        >
          <button
            type="button"
            onClick={() => setShowPhotoViewer(false)}
            className="absolute top-5 right-5 text-white"
            aria-label="Close profile picture viewer"
          >
            <Icon icon="mdi:close" className="w-7 h-7" />
          </button>
          <img
            src={photoUrl}
            alt={`${displayName} profile`}
            className="max-h-[88vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export default function EmpProfilePage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpDesktopMyProfileWorkspace />}
        mobile={<EmpProfileMobileContent />}
      />
    </EmpMobileLayout>
  );
}
