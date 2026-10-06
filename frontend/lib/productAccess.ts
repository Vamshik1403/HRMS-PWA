"use client";

import { useSyncExternalStore } from "react";
import { productRuleForHref } from "./productModules";

export const PRODUCT_ACCESS_KEY = "openhrmProductAccess";
const EVENT = "openhrm-product-access";

export type ProductAccessSnapshot = {
  companyId: number | null;
  subscriptionRequired: boolean;
  subscriptionStatus: string | null;
  subscriptionValidFrom: string | null;
  subscriptionValidTo: string | null;
  isSubscriptionExempt: boolean;
  modules: string[];
};

let snapshot: ProductAccessSnapshot | null = null;
const listeners = new Set<() => void>();

function readStored(): ProductAccessSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRODUCT_ACCESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProductAccessSnapshot;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function readProductAccess(): ProductAccessSnapshot | null {
  if (snapshot) return snapshot;
  snapshot = readStored();
  return snapshot;
}

export function setProductAccess(next: ProductAccessSnapshot | null) {
  snapshot = next;
  if (typeof window === "undefined") return;
  if (!next) localStorage.removeItem(PRODUCT_ACCESS_KEY);
  else localStorage.setItem(PRODUCT_ACCESS_KEY, JSON.stringify(next));
  emit();
}

export function clearProductAccess() {
  setProductAccess(null);
}

export function subscribeProductAccess(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProductAccess() {
  return useSyncExternalStore(subscribeProductAccess, readProductAccess, () => null);
}

export function subscriptionLimitsModules(): boolean {
  const access = readProductAccess();
  return !!access && access.subscriptionRequired === true && access.isSubscriptionExempt !== true;
}

export function canViewProductModule(moduleKey: string): boolean {
  const access = readProductAccess();
  if (!access || !access.subscriptionRequired || access.isSubscriptionExempt) return true;
  return access.modules.includes(moduleKey);
}

/** A hub tab with no product module is hidden once a company is limited to its plan. */
export function isHubTabAllowed(productModules?: string[]): boolean {
  if (!subscriptionLimitsModules()) return true;
  if (!productModules || productModules.length === 0) return false;
  return productModules.some((key) => canViewProductModule(key));
}

export function isProductHrefAllowed(href: string): boolean {
  const rule = productRuleForHref(href);
  if (!rule) return true;
  return rule.anyOf.some((key) => canViewProductModule(key));
}

export async function refreshProductAccess(token?: string | null) {
  if (typeof window === "undefined") return null;
  const accessToken =
    token || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
  if (!accessToken) {
    clearProductAccess();
    return null;
  }
  const res = await fetch("/backend/company-access/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return readProductAccess();
  const data = await res.json();
  const next: ProductAccessSnapshot = {
    companyId: data.companyId ?? null,
    subscriptionRequired: data.subscriptionRequired === true,
    subscriptionStatus: data.subscriptionStatus ?? null,
    subscriptionValidFrom: data.subscriptionValidFrom ?? null,
    subscriptionValidTo: data.subscriptionValidTo ?? null,
    isSubscriptionExempt: data.isSubscriptionExempt === true,
    modules: Array.isArray(data.modules) ? data.modules : [],
  };
  setProductAccess(next);
  return next;
}
