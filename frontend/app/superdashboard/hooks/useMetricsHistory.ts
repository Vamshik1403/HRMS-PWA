"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MetricsSnapshot = {
  ts: number;
  cpu: number;
  memory: number;
  disk: number;
  rxSec: number;
  txSec: number;
  dbActive: number;
  dbIdle: number;
  dbTotal: number;
};

const STORAGE_KEY = "hrms-superadmin-metrics-history";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_POINTS = 120;
const MIN_APPEND_MS = 8000;
const PERSIST_INTERVAL_MS = 30000;

function loadStored(): MetricsSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MetricsSnapshot[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((p) => p.ts >= cutoff).slice(-MAX_POINTS);
  } catch {
    return [];
  }
}

function snapshotFromMetrics(m: any): MetricsSnapshot {
  return {
    ts: Date.now(),
    cpu: Number(m.cpu?.usagePercent ?? 0),
    memory: Number(m.memory?.usagePercent ?? 0),
    disk: Number(m.disk?.root?.usagePercent ?? 0),
    rxSec: Number(m.network?.rxSec ?? 0),
    txSec: Number(m.network?.txSec ?? 0),
    dbActive: Number(m.database?.activeConnections ?? 0),
    dbIdle: Number(m.database?.idleConnections ?? 0),
    dbTotal: Number(m.database?.totalConnections ?? 0),
  };
}

function fingerprint(s: MetricsSnapshot) {
  return [s.cpu, s.memory, s.disk, s.rxSec, s.txSec, s.dbActive, s.dbIdle, s.dbTotal].join("|");
}

export function useMetricsHistory(metrics: any | null) {
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const initialized = useRef(false);
  const lastAppendAt = useRef(0);
  const lastFingerprint = useRef("");
  const dirtyRef = useRef(false);
  const historyRef = useRef<MetricsSnapshot[]>([]);

  useEffect(() => {
    if (!initialized.current) {
      const stored = loadStored();
      historyRef.current = stored;
      setHistory(stored);
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyRef.current.slice(-MAX_POINTS)));
        dirtyRef.current = false;
      } catch {
        /* ignore quota */
      }
    };

    const timer = window.setInterval(flush, PERSIST_INTERVAL_MS);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  const append = useCallback((m: any) => {
    if (!m) return;
    const snap = snapshotFromMetrics(m);
    const fp = fingerprint(snap);
    const now = Date.now();

    if (fp === lastFingerprint.current && now - lastAppendAt.current < MIN_APPEND_MS) {
      return;
    }

    lastFingerprint.current = fp;
    lastAppendAt.current = now;

    const cutoff = now - MAX_AGE_MS;
    const next = [...historyRef.current.filter((p) => p.ts >= cutoff), snap].slice(-MAX_POINTS);
    historyRef.current = next;
    dirtyRef.current = true;
    setHistory(next);
  }, []);

  useEffect(() => {
    if (metrics) append(metrics);
  }, [metrics, append]);

  const spark = useCallback(
    (key: keyof MetricsSnapshot, len = 24) => {
      const vals = historyRef.current.map((h) => Number(h[key] ?? 0));
      if (vals.length < 2) {
        const base = vals[vals.length - 1] ?? 0;
        return Array.from({ length: len }, (_, i) =>
          Math.max(0, base + Math.sin(i * 0.6) * (base * 0.04 + 1)),
        );
      }
      return vals.slice(-len);
    },
    [history],
  );

  const trend = useCallback(
    (key: keyof MetricsSnapshot) => {
      const vals = historyRef.current.map((h) => Number(h[key] ?? 0));
      if (vals.length < 2) return 0;
      const a = vals[vals.length - 2];
      const b = vals[vals.length - 1];
      if (a === 0) return b > 0 ? 100 : 0;
      return Number((((b - a) / a) * 100).toFixed(1));
    },
    [history],
  );

  const chartSeries = useCallback(
    (keys: (keyof MetricsSnapshot)[], maxPoints = 36) => {
      const slice = historyRef.current.slice(-maxPoints);
      return slice.map((p) => {
        const row: Record<string, number | string> = {
          time: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        keys.forEach((k) => {
          row[k] = Number(p[k] ?? 0);
        });
        return row;
      });
    },
    [history],
  );

  return { history, spark, trend, chartSeries };
};
