"use client";

import { useEffect, useState } from "react";

const TITLES: Record<string, string> = {
  TERMS_OF_USE: "Terms of Use",
  PRIVACY_POLICY: "Privacy Policy",
  SLA: "Service Level Agreement",
};

export function PublicPolicyPage({ type }: { type: string }) {
  const [policy, setPolicy] = useState<{
    policyName?: string;
    versionName?: string;
    effectiveFrom?: string;
    bodyHtml?: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/backend/company-policies/public/${type}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.id ? data : null;
      })
      .then((data) => {
        if (!cancelled) setPolicy(data);
      })
      .catch(() => {
        if (!cancelled) setPolicy(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  const title = policy?.policyName || TITLES[type] || "Policy";

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <a href="/login" className="text-sm text-primary underline underline-offset-2">
          Back to login
        </a>
        <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">{title}</h1>
        {policy?.versionName || policy?.effectiveFrom ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {policy.versionName ? `Version ${policy.versionName}` : ""}
            {policy.versionName && policy.effectiveFrom ? " · " : ""}
            {policy.effectiveFrom
              ? `Effective ${new Date(policy.effectiveFrom).toLocaleDateString()}`
              : ""}
          </p>
        ) : null}
        {!loaded ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : policy?.bodyHtml ? (
          <div
            className="prose prose-sm mt-8 max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: policy.bodyHtml }}
          />
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">This policy has not been published yet.</p>
        )}
      </div>
    </div>
  );
}
