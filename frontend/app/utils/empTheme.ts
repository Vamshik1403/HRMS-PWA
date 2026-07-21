export type EmpTheme = "light" | "dark";

export function readStoredEmpTheme(): EmpTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("_emp_appearance");
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Apply employee-portal theme to the document root (Tailwind `dark` + data attribute). */
export function applyEmpTheme(theme: EmpTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-emp-theme", theme);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
