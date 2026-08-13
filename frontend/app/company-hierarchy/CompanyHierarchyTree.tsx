"use client";

import { useEffect, useState, type ReactNode, Children } from "react";
import { Building2, User } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { resolveEmpPhoto } from "@/app/utils/empPhotoCache";

export type HierarchyPerson = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  employeePhotoUrl: string | null;
  branchName: string | null;
  departmentName: string | null;
  designationName: string | null;
  managerIds: number[];
  reporteeIds: number[];
  isCompanyOwner: boolean;
  isL1: boolean;
};

export type EmployeeTreeNode = {
  employee: HierarchyPerson;
  children: EmployeeTreeNode[];
};

export type DepartmentTreeNode = {
  id: number;
  departmentName: string | null;
  parentDepartmentID: number | null;
  level: number;
  branches: { id: number; branchName: string | null }[];
  employeeCount: number;
  employees: HierarchyPerson[];
  children: DepartmentTreeNode[];
};

export type HierarchyPayload = {
  company: { id: number; companyName: string | null; companyLogoUrl: string | null };
  l1Employees: HierarchyPerson[];
  departmentTree: DepartmentTreeNode[];
  employeeTree: EmployeeTreeNode[];
  unlinkedEmployees?: HierarchyPerson[];
};

function personName(p: HierarchyPerson) {
  const name = `${p.employeeFirstName ?? ""} ${p.employeeLastName ?? ""}`.trim();
  return name || p.employeeID || `Employee #${p.id}`;
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function CountBadge({
  count,
  active,
  onClick,
}: {
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold shadow-sm transition-colors",
        active ? "bg-sky-600 text-white" : "bg-white text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50",
      )}
      aria-label={active ? "Collapse" : `Show ${count} more`}
    >
      {count > 99 ? "99+" : count}
    </button>
  );
}

function Connector({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="flex h-full min-w-[52px] items-center">
      <div className="h-px w-5 bg-slate-300" />
      <CountBadge count={count} active={expanded} onClick={onToggle} />
      {expanded ? <div className="h-px w-5 bg-slate-300" /> : null}
    </div>
  );
}

function ChildStack({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  if (!items.length) return null;
  return (
    <div className="relative flex flex-col justify-center py-1">
      {items.length > 1 ? (
        <div className="pointer-events-none absolute bottom-[28px] left-0 top-[28px] w-px bg-slate-300" />
      ) : null}
      {items.map((child, i) => (
        <div key={i} className="relative flex items-center py-1.5">
          <div className="h-px w-5 shrink-0 bg-slate-300" />
          {child}
        </div>
      ))}
    </div>
  );
}

function AvatarBubble({
  src,
  label,
  tone = "sky",
}: {
  src?: string | null;
  label: string;
  tone?: "sky" | "slate" | "teal";
}) {
  const tones = {
    sky: "bg-sky-600 text-white",
    slate: "bg-slate-700 text-white",
    teal: "bg-teal-600 text-white",
  };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white",
        tones[tone],
      )}
    >
      {initials(label)}
    </div>
  );
}

function EntityCard({
  title,
  subtitle,
  avatar,
  selected,
  onClick,
  badge,
}: {
  title: string;
  subtitle?: string | null;
  avatar: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  badge?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[220px] max-w-[260px] items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition-colors",
        selected ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200 hover:border-slate-300",
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-slate-800">
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {badge ? (
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function PersonCard({
  person,
  selected,
  onClick,
}: {
  person: HierarchyPerson;
  selected?: boolean;
  onClick?: () => void;
}) {
  const name = personName(person);
  const photo = resolveEmpPhoto(String(person.id), person.employeePhotoUrl);
  return (
    <EntityCard
      title={name}
      subtitle={person.designationName || (person.isCompanyOwner ? "Owner" : person.departmentName)}
      selected={selected}
      onClick={onClick}
      badge={person.isL1 ? "L1" : person.isCompanyOwner ? "Owner" : null}
      avatar={<AvatarBubble src={photo} label={name} tone={person.isL1 ? "teal" : "sky"} />}
    />
  );
}

function DeptCard({
  dept,
  selected,
  onClick,
}: {
  dept: DepartmentTreeNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const name = dept.departmentName || `Department #${dept.id}`;
  return (
    <EntityCard
      title={name}
      subtitle={dept.branches.map((b) => b.branchName).filter(Boolean).join(", ") || `L${dept.level}`}
      selected={selected}
      onClick={onClick}
      badge={String(dept.employeeCount)}
      avatar={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[13px] font-bold text-sky-700 ring-1 ring-sky-100">
          {initials(name).slice(0, 1)}
        </div>
      }
    />
  );
}

function nestByManager(people: HierarchyPerson[]): EmployeeTreeNode[] {
  const ids = new Set(people.map((p) => p.id));
  const nodes = new Map<number, EmployeeTreeNode>();
  for (const p of people) nodes.set(p.id, { employee: p, children: [] });

  const attached = new Set<number>();
  const roots: EmployeeTreeNode[] = [];

  for (const p of people) {
    const node = nodes.get(p.id)!;
    const localManager = (p.managerIds || []).find((id) => ids.has(id) && id !== p.id);
    if (localManager && nodes.has(localManager) && !attached.has(p.id)) {
      nodes.get(localManager)!.children.push(node);
      attached.add(p.id);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (list: EmployeeTreeNode[]) => {
    list.sort((a, b) => personName(a.employee).localeCompare(personName(b.employee)));
    list.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

function DepartmentBranch({
  dept,
  expanded,
  onToggle,
}: {
  dept: DepartmentTreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const key = `dept-${dept.id}`;
  const open = expanded.has(key);
  const memberIds = new Set(dept.employees.map((e) => e.id));
  const linkedPeople = dept.employees.filter((e) =>
    (e.managerIds || []).some((id) => memberIds.has(id)),
  );
  const unlinkedPeople = dept.employees.filter(
    (e) => !linkedPeople.some((p) => p.id === e.id),
  );
  const linkedTrees = nestByManager(linkedPeople);
  const childDeptCount = dept.children.length;
  const canExpand = childDeptCount + dept.employees.length > 0;

  return (
    <div className="flex items-center">
      <DeptCard
        dept={dept}
        selected={open}
        onClick={() => {
          if (canExpand) onToggle(key);
        }}
      />
      <Connector
        count={childDeptCount}
        expanded={open}
        onToggle={() => onToggle(key)}
      />
      {open && childDeptCount > 0 ? (
        <ChildStack>
          {dept.children.map((child) => (
            <DepartmentBranch
              key={`dept-${child.id}`}
              dept={child}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ChildStack>
      ) : null}
      {open && (linkedTrees.length > 0 || unlinkedPeople.length > 0) ? (
        <div className="ml-6 flex flex-col justify-center gap-2">
          {linkedTrees.map((node) => (
            <EmployeeBranch
              key={`emp-${node.employee.id}`}
              node={node}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
          {unlinkedPeople.map((emp) => (
            <PersonCard key={`unlinked-${emp.id}`} person={emp} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmployeeBranch({
  node,
  expanded,
  onToggle,
  unlinkedPeers = [],
}: {
  node: EmployeeTreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  unlinkedPeers?: HierarchyPerson[];
}) {
  const key = `emp-${node.employee.id}`;
  const open = expanded.has(key);
  const count = node.children.length;
  const showPeers = unlinkedPeers.length > 0;
  const showLinked = open && count > 0;
  const showColumn = showLinked || showPeers;

  return (
    <div className="flex items-center">
      <PersonCard
        person={node.employee}
        selected={open}
        onClick={count ? () => onToggle(key) : undefined}
      />
      {count > 0 ? (
        <Connector count={count} expanded={open} onToggle={() => onToggle(key)} />
      ) : showPeers ? (
        <div className="min-w-[52px]" />
      ) : null}
      {showColumn ? (
        <div className="flex flex-col justify-center">
          {showLinked ? (
            <ChildStack>
              {node.children.map((child) => (
                <EmployeeBranch
                  key={child.employee.id}
                  node={child}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </ChildStack>
          ) : null}
          {showPeers
            ? unlinkedPeers.map((emp) => (
                <div key={`unlinked-${emp.id}`} className="relative flex items-center py-1.5">
                  <div className="w-5 shrink-0" />
                  <PersonCard person={emp} />
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function CompanyHierarchyTree({
  data,
  view,
}: {
  data: HierarchyPayload;
  view: "departments" | "employees";
}) {
  const companyLabel = data.company?.companyName || "Company";
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["company", "l2-depts"]),
  );

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const l1 = data.l1Employees ?? [];
  const l2Depts = data.departmentTree ?? [];
  const employeeRoots = data.employeeTree?.length
    ? data.employeeTree
    : l1.map((e) => ({ employee: e, children: [] as EmployeeTreeNode[] }));
  const unlinkedEmployees = data.unlinkedEmployees ?? [];

  const companyOpen = expanded.has("company");
  const l2Open = expanded.has("l2-depts");
  const companyChildCount =
    view === "employees" ? employeeRoots.length : l1.length || l2Depts.length;

  useEffect(() => {
    const first = employeeRoots[0]?.employee?.id;
    if (view !== "employees" || !first) return;
    setExpanded((prev) => {
      const key = `emp-${first}`;
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [view, employeeRoots[0]?.employee?.id]);

  return (
    <div className="min-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-[#f7f9fc] p-6">
      <div className="inline-flex min-w-full items-center">
        <EntityCard
          title={companyLabel}
          subtitle="Organisation"
          selected={companyOpen}
          onClick={() => onToggle("company")}
          avatar={
            data.company?.companyLogoUrl ? (
              <img
                src={data.company.companyLogoUrl}
                alt=""
                className="size-9 rounded-lg object-cover"
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-white">
                <Building2 className="size-4" />
              </div>
            )
          }
        />
        <Connector
          count={companyChildCount}
          expanded={companyOpen}
          onToggle={() => onToggle("company")}
        />

        {companyOpen && view === "departments" ? (
          <>
            {l1.length > 0 ? (
              <ChildStack>
                {l1.map((emp) => (
                  <PersonCard key={`l1-${emp.id}`} person={emp} />
                ))}
              </ChildStack>
            ) : null}
            {l2Depts.length > 0 ? (
              <>
                {l1.length > 0 ? (
                  <Connector
                    count={l2Depts.length}
                    expanded={l2Open}
                    onToggle={() => onToggle("l2-depts")}
                  />
                ) : null}
                {l1.length === 0 || l2Open ? (
                  <ChildStack>
                    {l2Depts.map((dept) => (
                      <DepartmentBranch
                        key={dept.id}
                        dept={dept}
                        expanded={expanded}
                        onToggle={onToggle}
                      />
                    ))}
                  </ChildStack>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {companyOpen && view === "employees" ? (
          employeeRoots.length > 0 ? (
            <ChildStack>
              {employeeRoots.map((node, index) => (
                <EmployeeBranch
                  key={node.employee.id}
                  node={node}
                  expanded={expanded}
                  onToggle={onToggle}
                  unlinkedPeers={index === 0 ? unlinkedEmployees : []}
                />
              ))}
            </ChildStack>
          ) : unlinkedEmployees.length > 0 ? (
            <div className="ml-6 flex flex-col justify-center gap-2">
              {unlinkedEmployees.map((emp) => (
                <PersonCard key={`unlinked-${emp.id}`} person={emp} />
              ))}
            </div>
          ) : null
        ) : null}

        {companyOpen &&
        companyChildCount === 0 &&
        unlinkedEmployees.length === 0 &&
        l2Depts.length === 0 ? (
          <p className="ml-4 flex items-center gap-2 text-sm text-slate-500">
            <User className="size-4" />
            No employees or departments to display yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
