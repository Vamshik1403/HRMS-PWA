"use client";

import { useEffect } from "react";
import { bootstrapServiceWorker } from "@/lib/serviceWorker";

/** Registers the PWA service worker on first page load. */
export default function ServiceWorkerBootstrap() {
  useEffect(() => {
    bootstrapServiceWorker();
  }, []);
  return null;
}
