export const PASSWORD_RULES = [
  {
    id: "len",
    label: "At least 8 characters",
    test: (password: string) => password.length >= 8,
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "digit",
    label: "One number",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export function getPasswordRuleFailures(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password || "")).map((rule) => rule.label);
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRuleFailures(password).length === 0;
}

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
