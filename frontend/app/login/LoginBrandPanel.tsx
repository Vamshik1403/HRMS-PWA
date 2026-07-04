import { Building2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";

interface FeatureItem {
  icon: LucideIcon;
  label: string;
}

const FEATURES: FeatureItem[] = [
  { icon: ShieldCheck, label: "Tenant-isolated by design" },
  { icon: Building2, label: "Branches & departments" },
  { icon: Sparkles, label: "Workflows & approvals" },
  { icon: ShieldCheck, label: "Audit trail for everything" },
];

export function LoginBrandPanel() {
  return (
    <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[hsl(222_47%_8%)] text-white p-12 isolate">
      <div className="absolute inset-0 grain opacity-[0.06] pointer-events-none" />
      <div className="absolute -top-32 -right-24 size-[520px] rounded-full bg-primary/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 size-[420px] rounded-full bg-cyan-500/15 blur-[120px] pointer-events-none" />

      <div className="relative flex items-center gap-3 text-white">
        <img
          src="/img/OpenHRM_Logo.png"
          alt="OpenHRM"
          className="size-10 rounded-xl object-cover shadow-lg"
        />
        <span className="font-display text-xl font-semibold tracking-tight">OpenHRM</span>
      </div>

      <div className="relative space-y-8 max-w-md">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium">
          <Sparkles className="size-3.5" />
          Enterprise HRMS Platform
        </div>
        <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] font-medium">
          Run payroll, attendance, leave & people ops{" "}
          <span className="text-primary">— end to end.</span>
        </h1>
        <p className="text-base text-white/65 leading-relaxed">
          A modular, multi-tenant platform for HR teams that want enterprise control without enterprise bloat.
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-white/80">
              <div className="size-7 rounded-md bg-white/5 grid place-items-center text-primary">
                <Icon className="size-3.5" />
              </div>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="relative text-xs text-white/40 font-mono">
        © {new Date().getFullYear()} OpenHRM · v1.0.0
      </div>
    </aside>
  );
}
