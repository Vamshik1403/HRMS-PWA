"use client";

import { useCallback, useState } from "react";

export function useClientTable(initialSortBy: string | null = null) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(initialSortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const setSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  return { search, setSearch, sortBy, sortDir, setSort };
}

export function sortRows<T>(
  rows: T[],
  sortBy: string | null,
  sortDir: "asc" | "desc",
  getValue: (row: T, key: string) => string | number,
): T[] {
  if (!sortBy) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = String(getValue(a, sortBy)).toLowerCase();
    const bv = String(getValue(b, sortBy)).toLowerCase();
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}
