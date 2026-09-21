"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { fetchGPSOnUserGesture, type LocationCoords } from "../../utils/empGeolocation";
import type { PunchCheckType } from "../../hooks/useEmpPunch";

type PhotoPunchType = Extract<PunchCheckType, "CHECK_IN" | "CHECK_OUT">;

export type EmpPhotoPunchCaptureHandle = {
  startFromGesture: (checkType: PhotoPunchType) => void;
};

export const EmpPhotoPunchCapture = forwardRef<
  EmpPhotoPunchCaptureHandle,
  {
    submitting: boolean;
    onSubmit: (checkType: PhotoPunchType, file: File, location: LocationCoords) => Promise<boolean>;
    onError?: (message: string) => void;
  }
>(function EmpPhotoPunchCapture({ submitting, onSubmit, onError }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gpsRef = useRef<Promise<LocationCoords> | null>(null);
  const pendingTypeRef = useRef<PhotoPunchType | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [pendingType, setPendingType] = useState<PhotoPunchType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const reset = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPendingType(null);
    pendingTypeRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    gpsRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  };

  const startFromGesture = (checkType: PhotoPunchType) => {
    pendingTypeRef.current = checkType;
    setPendingType(checkType);
    gpsRef.current = fetchGPSOnUserGesture();
    inputRef.current?.click();
  };

  useImperativeHandle(ref, () => ({ startFromGesture }), []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] || null;
    e.target.value = "";
    if (!next) {
      reset();
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setFile(next);
    setPreviewUrl(url);
  };

  const submit = async () => {
    const checkType = pendingTypeRef.current;
    if (!checkType || !file) return;
    try {
      const location = gpsRef.current
        ? await gpsRef.current
        : await fetchGPSOnUserGesture();
      const ok = await onSubmit(checkType, file, location);
      if (ok) reset();
    } catch (err: any) {
      onError?.(err?.message || "Could not get location.");
    }
  };

  const retake = () => {
    const type = pendingTypeRef.current;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
    if (type) startFromGesture(type);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onFileChange}
      />
      {pendingType && previewUrl && file ? (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => !submitting && reset()} />
          <div className="fixed inset-x-4 top-[12%] z-[61] mx-auto max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">
              {pendingType === "CHECK_IN" ? "Mark IN photo" : "Mark OUT photo"}
            </h3>
            <p className="text-[12px] text-gray-500 mb-3">
              Review your photo, then submit. Location is checked against the office or assigned site radius.
            </p>
            <img
              src={previewUrl}
              alt="Punch preview"
              className="w-full max-h-64 object-cover rounded-xl border border-gray-100 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={retake}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-medium text-gray-700 disabled:opacity-50"
              >
                Retake
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="flex-1 h-11 rounded-xl bg-[#4f46e5] text-white font-semibold disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={reset}
              className="mt-2 w-full h-10 text-[13px] text-gray-500"
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </>
  );
});
