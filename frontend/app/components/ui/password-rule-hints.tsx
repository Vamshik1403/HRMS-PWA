"use client";

import { getPasswordRuleFailures } from "@/lib/passwordRules";

export function PasswordRuleHints({ password }: { password: string }) {
  if (!password) return null;
  const failed = getPasswordRuleFailures(password);
  if (!failed.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {failed.map((label) => (
        <li key={label} className="text-xs text-red-600">
          {label}
        </li>
      ))}
    </ul>
  );
}
