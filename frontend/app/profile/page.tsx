"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { getSidebarContext } from "@/app/utils/sidebarContext";

const API = "/backend";

type LoggedUser = {
  id: number;
  username: string;
  role: string;
  companyID?: number | null;
  serviceProviderID?: number | null;
  userCompanies?: {
    companyID: number;
    isPrimary?: boolean;
    company?: { id: number; companyName: string };
  }[];
};

type ProfileType = "SERVICE_PROVIDER" | "COMPANY";

type CompanyRow = {
  id: number;
  serviceProviderID?: number;
  companyName?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  timeZone?: string;
  currency?: string;
  pfNo?: string;
  panNo?: string;
  tanNo?: string;
  esiNo?: string;
  linNo?: string;
  gstNo?: string;
  contactNo?: string;
  emailAdd?: string;
  companyType?: string;
  serviceProvider?: { companyName?: string };
};

const emptyForm = {
  companyName: "",
  address: "",
  country: "",
  state: "",
  city: "",
  pincode: "",
  countryCode: "",
  timeZone: "",
  currency: "",
  pfNo: "",
  panNo: "",
  tanNo: "",
  esiNo: "",
  linNo: "",
  gstNo: "",
  contactNo: "",
  emailAdd: "",
  website: "",
  companyType: "",
  serviceProviderName: "",
};

function getUser(): LoggedUser | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    u.role = String(u.role || "").toUpperCase();
    return u;
  } catch {
    return null;
  }
}

function getMappedCompanyIds(user: LoggedUser | null): number[] {
  const ids = new Set<number>();

  if (user?.companyID) ids.add(Number(user.companyID));

  if (Array.isArray(user?.userCompanies)) {
    user.userCompanies.forEach((x) => {
      if (x.companyID) ids.add(Number(x.companyID));
    });
  }

  return Array.from(ids);
}

function getActiveCompanyIdFromApp(): number | null {
  const ctx = getSidebarContext();
  if (ctx?.companyID) return Number(ctx.companyID);

  const stored = sessionStorage.getItem("activeCompanyID");
  if (stored) return Number(stored);

  return null;
}

export default function ProfilePage() {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [profileType, setProfileType] = useState<ProfileType>("COMPANY");
  const [recordId, setRecordId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const mappedCompanyIds = useMemo(() => getMappedCompanyIds(user), [user]);

  useEffect(() => {
    const u = getUser();
    setUser(u);

    if (!u) {
      setLoading(false);
      return;
    }

    if (u.role === "SERVICE_PROVIDER") {
      if (!u.serviceProviderID) {
        setLoading(false);
        return;
      }

      setProfileType("SERVICE_PROVIDER");
      setRecordId(Number(u.serviceProviderID));
      loadServiceProvider(Number(u.serviceProviderID));
      return;
    }

    setProfileType("COMPANY");
    loadCompanyForLoggedUser(u);

    const refreshProfile = () => {
      const latest = getUser();
      if (latest?.role !== "SERVICE_PROVIDER") {
        loadCompanyForLoggedUser(latest || u);
      }
    };

    window.addEventListener("sidebar-context-changed", refreshProfile);
    window.addEventListener("app-data-refresh", refreshProfile);

    return () => {
      window.removeEventListener("sidebar-context-changed", refreshProfile);
      window.removeEventListener("app-data-refresh", refreshProfile);
    };
  }, []);

  async function loadServiceProvider(serviceProviderID: number) {
    setLoading(true);

    try {
      const res = await fetch(`${API}/service-provider`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load service provider");

      const json = await res.json();
      const list = Array.isArray(json) ? json : json?.data ?? [];

      const sp = list.find((x: any) => Number(x.id) === Number(serviceProviderID));
      if (!sp) throw new Error("Service provider profile not found");

      setForm({
        companyName: sp.companyName || "",
        address: sp.companyAddress || "",
        country: sp.country || "",
        state: sp.state || "",
        city: sp.city || "",
        pincode: sp.pincode || "",
        countryCode: sp.countryCode || "",
        timeZone: "",
        currency: "",
        pfNo: "",
        panNo: "",
        tanNo: "",
        esiNo: "",
        linNo: "",
        gstNo: sp.gstNo || "",
        contactNo: sp.contactNo || "",
        emailAdd: sp.emailAdd || "",
        website: sp.website || "",
        companyType: "",
        serviceProviderName: sp.companyName || "",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanyForLoggedUser(u: LoggedUser) {
    setLoading(true);

    try {
      const res = await fetch(`${API}/company`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load company");

      const json = await res.json();
      const allCompanies: CompanyRow[] = Array.isArray(json) ? json : json?.data ?? [];

      const allowedIds = getMappedCompanyIds(u);

      if (allowedIds.length === 0) {
        throw new Error("No company is mapped with this login");
      }

      const allowedCompanies = allCompanies.filter((c) =>
        allowedIds.includes(Number(c.id))
      );

      if (allowedCompanies.length === 0) {
        throw new Error("Mapped company profile not found");
      }

      const activeCompanyId = getActiveCompanyIdFromApp();

      const selectedCompany =
        allowedCompanies.find((c) => Number(c.id) === Number(activeCompanyId)) ||
        allowedCompanies.find((c) => Number(c.id) === Number(u.companyID)) ||
        allowedCompanies.find((c) =>
          u.userCompanies?.some(
            (uc) => uc.isPrimary && Number(uc.companyID) === Number(c.id)
          )
        ) ||
        allowedCompanies[0];

      selectCompanyForEdit(selectedCompany);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  function selectCompanyForEdit(company: CompanyRow) {
    setRecordId(Number(company.id));
    setProfileType("COMPANY");

    setForm({
      companyName: company.companyName || "",
      address: company.address || "",
      country: company.country || "",
      state: company.state || "",
      city: company.city || "",
      pincode: company.pincode || "",
      countryCode: "",
      timeZone: company.timeZone || "",
      currency: company.currency || "",
      pfNo: company.pfNo || "",
      panNo: company.panNo || "",
      tanNo: company.tanNo || "",
      esiNo: company.esiNo || "",
      linNo: company.linNo || "",
      gstNo: company.gstNo || "",
      contactNo: company.contactNo || "",
      emailAdd: company.emailAdd || "",
      website: "",
      companyType: company.companyType || "",
      serviceProviderName: company.serviceProvider?.companyName || "",
    });
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!recordId) {
      toast.error("No profile record selected");
      return;
    }

    setSaving(true);

    try {
      const url =
        profileType === "SERVICE_PROVIDER"
          ? `${API}/service-provider/${recordId}`
          : `${API}/company/${recordId}`;

      const payload =
        profileType === "SERVICE_PROVIDER"
          ? {
              companyName: form.companyName,
              companyAddress: form.address,
              country: form.country,
              state: form.state,
              city: form.city,
              pincode: form.pincode,
              countryCode: form.countryCode,
              gstNo: form.gstNo,
              contactNo: form.contactNo,
              emailAdd: form.emailAdd,
              website: form.website,
            }
          : {
              companyName: form.companyName,
              address: form.address,
              country: form.country,
              state: form.state,
              city: form.city,
              pincode: form.pincode,
              timeZone: form.timeZone,
              currency: form.currency,
              pfNo: form.pfNo,
              panNo: form.panNo,
              tanNo: form.tanNo,
              esiNo: form.esiNo,
              linNo: form.linNo,
              gstNo: form.gstNo,
              contactNo: form.contactNo,
              emailAdd: form.emailAdd,
              companyType: form.companyType,
            };

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Profile updated successfully");

      if (profileType === "SERVICE_PROVIDER") {
        await loadServiceProvider(recordId);
      } else if (user) {
        await loadCompanyForLoggedUser(user);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading profile...</div>;
  }

  if (!recordId) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">
          No profile record is mapped with this login.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h1 className="text-3xl font-bold">
            {profileType === "SERVICE_PROVIDER"
              ? "Service Provider Profile"
              : "Company Profile"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {profileType === "COMPANY"
              ? "Showing selected company profile from the sidebar company switcher."
              : "Edit details mapped with your login."}
          </p>
        </div>
      </div>

      <ProfileForm
        profileType={profileType}
        form={form}
        saving={saving}
        setField={setField}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function ProfileForm({
  profileType,
  form,
  saving,
  setField,
  onSubmit,
}: {
  profileType: ProfileType;
  form: typeof emptyForm;
  saving: boolean;
  setField: (key: keyof typeof emptyForm, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-card p-6 space-y-6">
      <div className="border-l-2 border-primary pl-4">
        <h2 className="text-xl font-semibold">
          {profileType === "SERVICE_PROVIDER"
            ? "Edit Service Provider"
            : "Edit Company Profile"}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {profileType === "COMPANY" && (
          <InputBlock label="Service Provider" value={form.serviceProviderName} readOnly />
        )}

        <InputBlock
          label={profileType === "SERVICE_PROVIDER" ? "Service Provider Name *" : "Company Name *"}
          value={form.companyName}
          onChange={(v) => setField("companyName", v)}
        />

        <div className="space-y-2 md:col-span-2">
          <Label>{profileType === "SERVICE_PROVIDER" ? "Company Address" : "Address"}</Label>
          <textarea
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
            className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <InputBlock label="Country" value={form.country} onChange={(v) => setField("country", v)} />
        <InputBlock label="State" value={form.state} onChange={(v) => setField("state", v)} />
        <InputBlock label="City" value={form.city} onChange={(v) => setField("city", v)} />
        <InputBlock label="Pincode" value={form.pincode} onChange={(v) => setField("pincode", v)} />

        {profileType === "SERVICE_PROVIDER" && (
          <>
            <InputBlock label="Country Code" value={form.countryCode} onChange={(v) => setField("countryCode", v)} />
            <InputBlock label="Website" value={form.website} onChange={(v) => setField("website", v)} />
          </>
        )}

        {profileType === "COMPANY" && (
          <>
            <InputBlock label="Time Zone" value={form.timeZone} onChange={(v) => setField("timeZone", v)} />
            <InputBlock label="Currency" value={form.currency} onChange={(v) => setField("currency", v)} />
            <InputBlock label="Company Type" value={form.companyType} onChange={(v) => setField("companyType", v)} />
          </>
        )}

        <InputBlock label="Contact No" value={form.contactNo} onChange={(v) => setField("contactNo", v)} />
        <InputBlock label="Email" value={form.emailAdd} onChange={(v) => setField("emailAdd", v)} />
        <InputBlock label="GST No" value={form.gstNo} onChange={(v) => setField("gstNo", v)} />

        {profileType === "COMPANY" && (
          <>
            <InputBlock label="PAN No" value={form.panNo} onChange={(v) => setField("panNo", v)} />
            <InputBlock label="PF No" value={form.pfNo} onChange={(v) => setField("pfNo", v)} />
            <InputBlock label="TAN No" value={form.tanNo} onChange={(v) => setField("tanNo", v)} />
            <InputBlock label="ESI No" value={form.esiNo} onChange={(v) => setField("esiNo", v)} />
            <InputBlock label="LIN No" value={form.linNo} onChange={(v) => setField("linNo", v)} />
          </>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={saving} className="min-w-36">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

function InputBlock({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value || ""}
        readOnly={readOnly}
        className={readOnly ? "bg-muted/40" : ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}