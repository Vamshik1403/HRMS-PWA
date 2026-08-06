"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormDrawer } from "../ui/form-drawer";
import { EntityDetailHero, EntityDetailLayout } from "../app/entity-detail-layout";
import { DetailCard } from "../app/detail-card";
import { LEGAL_ENTITY_OPTIONS } from "@/lib/companyAccess";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getSidebarContext } from "../../utils/sidebarContext";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface CompanyDetails {
  id: number;
  companyName?: string | null;
  legalEntityType?: string | null;
  companyType?: string | null;
  address?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  contactNo?: string | null;
  emailAdd?: string | null;
  timeZone?: string | null;
  currency?: string | null;
  gstNo?: string | null;
  pfNo?: string | null;
  tanNo?: string | null;
  panNo?: string | null;
  esiNo?: string | null;
  linNo?: string | null;
  shopRegNo?: string | null;
  financialYearStart?: string | null;
  companyLogoUrl?: string | null;
  SignatureUrl?: string | null;
}

/**
 * Read-only view of the tenant's own company profile, in the same
 * hero + DetailCard layout used by the employee "View" modal.
 */
export function CompanyInfoViewModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveCompanyId = useCallback(async () => {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return ctx.companyID;
    if (user?.companyID) return user.companyID;
    return null;
  }, [user]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const id = await resolveCompanyId();
        if (!id) {
          setCompany(null);
          return;
        }
        const res = await fetch(`${BACKEND}/company/${id}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        setCompany(await res.json());
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not load company details");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, resolveCompanyId]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Company Details"
      showHeaderCancel
      cancelLabel="Close"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : !company ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Could not load company details.</p>
      ) : (
        <EntityDetailLayout
          hero={
            <EntityDetailHero
              title={company.companyName || "—"}
              subtitle={
                <span>
                  {[
                    LEGAL_ENTITY_OPTIONS.find((o) => o.value === company.legalEntityType)?.label,
                    company.companyType,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              }
            />
          }
        >
          <DetailCard
            title="Overview"
            subtitle="Core company details"
            rows={[
              { label: "Company name", value: company.companyName },
              {
                label: "Company type",
                value:
                  LEGAL_ENTITY_OPTIONS.find((o) => o.value === company.legalEntityType)?.label ||
                  company.legalEntityType ||
                  "—",
              },
              { label: "Establishment type", value: company.companyType },
              { label: "Address", value: company.address },
            ]}
          />
          <DetailCard
            title="Location"
            subtitle="Regional address details"
            rows={[
              { label: "Country", value: company.country },
              { label: "State", value: company.state },
              { label: "City", value: company.city },
              { label: "Pincode", value: company.pincode },
            ]}
          />
          <DetailCard
            title="Contact"
            subtitle="Primary contact details"
            rows={[
              { label: "Contact number", value: company.contactNo },
              { label: "Email", value: company.emailAdd },
              { label: "Time zone", value: company.timeZone },
              { label: "Currency", value: company.currency },
            ]}
          />
          <DetailCard
            title="Statutory"
            subtitle="Government and legal identifiers"
            rows={[
              { label: "GST No", value: company.gstNo },
              { label: "PF", value: company.pfNo },
              { label: "TAN", value: company.tanNo },
              { label: "PAN", value: company.panNo },
              { label: "ESI", value: company.esiNo },
              { label: "LIN", value: company.linNo },
              { label: "Shop registration", value: company.shopRegNo },
              { label: "Financial year start", value: company.financialYearStart },
            ]}
          />
          {(company.companyLogoUrl || company.SignatureUrl) ? (
            <DetailCard title="Branding" subtitle="Logo and signature" className="lg:col-span-2">
              <div className="flex flex-wrap gap-6">
                {company.companyLogoUrl ? (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">Company logo</p>
                    <img src={company.companyLogoUrl} alt="Company Logo" className="h-24 w-24 rounded-lg border object-contain" />
                  </div>
                ) : null}
                {company.SignatureUrl ? (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">Signature</p>
                    <img src={company.SignatureUrl} alt="Signature" className="h-24 w-24 rounded-lg border object-contain" />
                  </div>
                ) : null}
              </div>
            </DetailCard>
          ) : null}
        </EntityDetailLayout>
      )}
    </FormDrawer>
  );
}
