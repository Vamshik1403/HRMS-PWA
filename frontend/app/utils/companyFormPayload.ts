/** Scalar fields accepted by POST/PATCH /backend/company */
export const COMPANY_SCALAR_FIELDS = [
  "serviceProviderID",
  "companyName",
  "companyType",
  "legalEntityType",
  "defaultOwnerTitle",
  "address",
  "country",
  "state",
  "city",
  "pincode",
  "timeZone",
  "currency",
  "pfNo",
  "tanNo",
  "panNo",
  "esiNo",
  "linNo",
    "gstNo",
    "gstCertUrl",
    "website",
    "gstRegistrationType",
    "businessTradeName",
  "shopRegNo",
  "shopRegCertHistory",
  "financialYearStart",
  "contactNo",
  "emailAdd",
  "companyLogoUrl",
  "SignatureUrl",
  "noticePeriodDaysForResignation",
  "noticePeriodDaysForTermination",
  "pwaShowLeaveBalance",
] as const;

export type CompanyScalarField = (typeof COMPANY_SCALAR_FIELDS)[number];

export const FINANCIAL_YEAR_EMPTY = "__fy_empty__";

export function mapCompanyToFormData(company: Record<string, unknown> | object) {
  const row = company as Record<string, unknown>;
  const history = row.shopRegCertHistory;
  return {
    companyName: (row.companyName as string) ?? "",
    companyType: (row.companyType as string) ?? "",
    legalEntityType: (row.legalEntityType as string) ?? "",
    defaultOwnerTitle: (row.defaultOwnerTitle as string) ?? "",
    noticePeriodDaysForResignation: (row.noticePeriodDaysForResignation as string) ?? "",
    noticePeriodDaysForTermination: (row.noticePeriodDaysForTermination as string) ?? "",
    address: (row.address as string) ?? "",
    country: (row.country as string) ?? "",
    state: (row.state as string) ?? "",
    city: (row.city as string) ?? "",
    pincode: (row.pincode as string) ?? "",
    timeZone: (row.timeZone as string) ?? "",
    currency: (row.currency as string) ?? "",
    pfNo: (row.pfNo as string) ?? "",
    tanNo: (row.tanNo as string) ?? "",
    panNo: (row.panNo as string) ?? "",
    esiNo: (row.esiNo as string) ?? "",
    linNo: (row.linNo as string) ?? "",
    gstNo: (row.gstNo as string) ?? "",
    gstCertUrl: (row.gstCertUrl as string) ?? "",
    website: (row.website as string) ?? "",
    gstRegistrationType: (row.gstRegistrationType as string) ?? "",
    businessTradeName: (row.businessTradeName as string) ?? "",
    shopRegNo: (row.shopRegNo as string) ?? "",
    shopRegCertHistory: Array.isArray(history)
      ? history.map((entry: Record<string, unknown>, index: number) => ({
          certNo: String(entry.certNo ?? ""),
          effectFrom: String(entry.effectFrom ?? ""),
          pdfUrl: entry.pdfUrl ? String(entry.pdfUrl) : undefined,
          _localId: String(entry._localId ?? `sr-${index}`),
        }))
      : [],
    financialYearStart: (row.financialYearStart as string) ?? "",
    contactNo: (row.contactNo as string) ?? "",
    emailAdd: (row.emailAdd as string) ?? "",
    companyLogoUrl: (row.companyLogoUrl as string) ?? "",
    SignatureUrl: (row.SignatureUrl as string) ?? "",
    serviceProviderID: (row.serviceProviderID as number | null | undefined) ?? undefined,
    autocompleteName:
      (row.serviceProvider as { companyName?: string } | undefined)?.companyName ?? "",
    pwaShowLeaveBalance:
      typeof row.pwaShowLeaveBalance === "boolean" ? row.pwaShowLeaveBalance : undefined,
  };
}

export function buildCompanyPayload(
  formData: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  const payload: Record<string, unknown> = {};

  for (const key of COMPANY_SCALAR_FIELDS) {
    const raw = formData[key];
    if (raw === undefined || raw === null) continue;

    if (key === "shopRegCertHistory") {
      if (!Array.isArray(raw)) continue;
      payload[key] = raw.map((entry: Record<string, unknown>) => {
        const row: Record<string, string> = {
          certNo: String(entry.certNo ?? ""),
          effectFrom: String(entry.effectFrom ?? ""),
        };
        if (entry.pdfUrl) row.pdfUrl = String(entry.pdfUrl);
        return row;
      });
      continue;
    }

    if (key === "emailAdd") {
      const email = String(raw).trim();
      if (!email) continue;
      payload[key] = email;
      continue;
    }

    if (typeof raw === "string" && raw.trim() === "" && key !== "companyName") {
      continue;
    }

    payload[key] = raw;
  }

  return { ...payload, ...overrides };
}
