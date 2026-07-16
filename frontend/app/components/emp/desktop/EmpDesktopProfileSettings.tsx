"use client";

import { Palette } from "lucide-react";
import { useEmpProfile } from "../../../hooks/useEmpProfile";

/** Appearance preferences for the profile workspace. */
export function EmpDesktopProfileSettings() {
  const { appearance, changeAppearance } = useEmpProfile();

  return (
    <>
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

      <p className="text-xs text-muted-foreground">OpenHRM · v1.0.0</p>
    </>
  );
}
