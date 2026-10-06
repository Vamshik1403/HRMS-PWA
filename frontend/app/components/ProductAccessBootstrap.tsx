"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { refreshCompanyAccess } from "@/lib/companyAccess";
import { isProductHrefAllowed, refreshProductAccess } from "@/lib/productAccess";

function Guard() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (token) {
      void refreshProductAccess(token);
      void refreshCompanyAccess(token);
    }
    const onStale = () => {
      void refreshProductAccess();
    };
    window.addEventListener("openhrm-product-access-stale", onStale);
    return () => window.removeEventListener("openhrm-product-access-stale", onStale);
  }, []);

  useEffect(() => {
    if (!pathname || pathname === "/module-unavailable" || pathname === "/login") return;
    const href = search?.toString() ? `${pathname}?${search.toString()}` : pathname;
    if (!isProductHrefAllowed(href)) {
      router.replace("/module-unavailable");
    }
  }, [pathname, search, router]);

  return null;
}

export default function ProductAccessBootstrap() {
  return (
    <Suspense fallback={null}>
      <Guard />
    </Suspense>
  );
}
