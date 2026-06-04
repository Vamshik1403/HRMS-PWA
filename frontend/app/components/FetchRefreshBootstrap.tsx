"use client";

import { useEffect } from "react";
import { ensureFetchRefreshPatch } from "../utils/patchFetchForRefresh";

/** Installs global fetch hook so list pages refresh after POST/PATCH/DELETE. */
export default function FetchRefreshBootstrap() {
  useEffect(() => {
    ensureFetchRefreshPatch();
  }, []);
  return null;
}
