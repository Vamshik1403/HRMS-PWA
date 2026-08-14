"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CompanyNode } from "./CompanyNode";
import { DepartmentNode } from "./DepartmentNode";
import { EmployeeNode } from "./EmployeeNode";
import { layoutOrgTree, placeUnlinkedOnLastRow, NODE_SIZE, type LayoutTree } from "./layout";
import { OrgChartToolbar } from "./OrgChartToolbar";
import type {
  DepartmentNodeData,
  Employee,
  OrgChartData,
  OrgDepartment,
  OrgNodeData,
} from "./types";

const nodeTypes = {
  company: CompanyNode,
  employee: EmployeeNode,
  department: DepartmentNode,
};

const GOLD = "#C9962A";
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 1.8;

type RFNode = Node<OrgNodeData>;
type ChartView = "employees" | "departments";

function pruneCollapsed(node: LayoutTree, collapsed: Set<string>): LayoutTree {
  if (collapsed.has(node.id)) return { ...node, children: [] };
  return { ...node, children: node.children.map((c) => pruneCollapsed(c, collapsed)) };
}

function reportsByManager(employees: Employee[]) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const reports = new Map<string, Employee[]>();
  for (const e of employees) {
    if (!e.managerId || !byId.has(e.managerId)) continue;
    if (!reports.has(e.managerId)) reports.set(e.managerId, []);
    reports.get(e.managerId)!.push(e);
  }
  for (const list of reports.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return reports;
}

function buildEmployeeTree(
  employees: Employee[],
): {
  tree: LayoutTree;
  linkedEdges: Set<string>;
  childMap: Map<string, string[]>;
  unlinkedIds: string[];
} {
  const reports = reportsByManager(employees);
  const linkedEdges = new Set<string>();
  const childMap = new Map<string, string[]>();
  const placed = new Set<string>();

  const addChild = (parent: string, child: string, linked: boolean) => {
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push(child);
    if (linked) linkedEdges.add(`${parent}->${child}`);
  };

  const walk = (emp: Employee): LayoutTree => {
    placed.add(emp.id);
    const kids: LayoutTree[] = [];
    for (const child of reports.get(emp.id) || []) {
      addChild(emp.id, child.id, true);
      kids.push(walk(child));
    }
    return { id: emp.id, kind: "employee", children: kids };
  };

  const roots = employees
    .filter((e) => e.isCompanyOwner || e.isL1 || !e.department)
    .filter((e) => !e.managerId || e.isCompanyOwner || e.isL1)
    .sort((a, b) => Number(b.isCompanyOwner) - Number(a.isCompanyOwner) || a.name.localeCompare(b.name));

  const uniqueRoots: Employee[] = [];
  const seen = new Set<string>();
  for (const e of roots) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    uniqueRoots.push(e);
  }

  const companyChildren: LayoutTree[] = uniqueRoots.map((emp) => {
    addChild("company", emp.id, true);
    return walk(emp);
  });

  const unlinkedIds = employees
    .filter((e) => !placed.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => e.id);

  return {
    tree: { id: "company", kind: "company", children: companyChildren },
    linkedEdges,
    childMap,
    unlinkedIds,
  };
}

function buildDepartmentTree(
  employees: Employee[],
  departments: OrgDepartment[],
): {
  tree: LayoutTree;
  linkedEdges: Set<string>;
  childMap: Map<string, string[]>;
  unlinkedIds: string[];
} {
  const linkedEdges = new Set<string>();
  const childMap = new Map<string, string[]>();

  const addChild = (parent: string, child: string) => {
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push(child);
    linkedEdges.add(`${parent}->${child}`);
  };

  const byParent = new Map<string | null, OrgDepartment[]>();
  for (const d of departments) {
    const key = d.parentDepartmentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(d);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const members = new Map<string, Employee[]>();
  for (const emp of employees) {
    if (!emp.department) continue;
    const dept = departments.find((d) => d.name === emp.department);
    if (!dept) continue;
    if (!members.has(dept.id)) members.set(dept.id, []);
    members.get(dept.id)!.push(emp);
  }
  for (const list of members.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const walkDept = (dept: OrgDepartment): LayoutTree => {
    const kids: LayoutTree[] = [];
    for (const child of byParent.get(dept.id) || []) {
      addChild(dept.id, child.id);
      kids.push(walkDept(child));
    }
    for (const emp of members.get(dept.id) || []) {
      addChild(dept.id, emp.id);
      kids.push({ id: emp.id, kind: "employee", children: [] });
    }
    return { id: dept.id, kind: "department", children: kids };
  };

  const roots = byParent.get(null) || departments.filter((d) => !d.parentDepartmentId);
  const companyChildren = roots.map((dept) => {
    addChild("company", dept.id);
    return walkDept(dept);
  });

  return {
    tree: { id: "company", kind: "company", children: companyChildren },
    linkedEdges,
    childMap,
    unlinkedIds: [],
  };
}

function AlignTreeTop({ nodes, view }: { nodes: RFNode[]; view: ChartView }) {
  const rf = useReactFlow();
  useEffect(() => {
    if (!nodes.length) return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const bounds = getNodesBounds(nodes);
      const pane = document.querySelector(".org-chart-canvas") as HTMLElement | null;
      const w = pane?.clientWidth ?? 0;
      const h = pane?.clientHeight ?? 0;
      if (w < 80 || h < 80) return;
      const zoom = Math.min(
        1,
        Math.max(MIN_ZOOM, Math.min((w - 48) / Math.max(bounds.width, 1), (h - 32) / Math.max(bounds.height, 1))),
      );
      const x = (w - bounds.width * zoom) / 2 - bounds.x * zoom;
      const y = 12 - bounds.y * zoom;
      rf.setViewport({ x, y, zoom }, { duration: 0 });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
    // Only re-align when the tree view or node count changes — never while the user is zooming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, view]);
  return null;
}

function OrgChartCanvas({
  nodes,
  edges,
  view,
  onEmployeeClick,
  onHoverNode,
}: {
  nodes: RFNode[];
  edges: Edge[];
  view: ChartView;
  onEmployeeClick: (id: string) => void;
  onHoverNode: (id: string | null) => void;
}) {
  const onNodeClick = useCallback(
    (_event: MouseEvent, node: RFNode) => {
      if (node.type === "employee") onEmployeeClick(node.id);
    },
    [onEmployeeClick],
  );

  return (
    <ReactFlow
      key={view}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={false}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick
      autoPanOnNodeDrag={false}
      noPanClassName="nopan"
      onNodeClick={onNodeClick}
      onNodeMouseEnter={(_event, node) => onHoverNode(node.id)}
      onNodeMouseLeave={() => onHoverNode(null)}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        type: "smoothstep",
        style: { stroke: GOLD, strokeWidth: 1.8 },
      }}
      className="org-chart-canvas h-full"
    >
      <AlignTreeTop nodes={nodes} view={view} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function OrgChart({ data }: { data: OrgChartData }) {
  const router = useRouter();
  const [view, setView] = useState<ChartView>("employees");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { tree: fullTree, linkedEdges, childMap, unlinkedIds } = useMemo(
    () =>
      view === "employees"
        ? buildEmployeeTree(data.employees)
        : buildDepartmentTree(data.employees, data.departments),
    [view, data],
  );

  const tree = useMemo(() => pruneCollapsed(fullTree, collapsed), [fullTree, collapsed]);
  const positions = useMemo(() => {
    const pos = layoutOrgTree(tree);
    placeUnlinkedOnLastRow(pos, unlinkedIds);
    return pos;
  }, [tree, unlinkedIds]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openProfile = useCallback(
    (id: string) => {
      router.push(`/empTeam/member/${id}`);
    },
    [router],
  );

  const changeView = useCallback((next: ChartView) => {
    setView(next);
    setCollapsed(new Set());
  }, []);

  const nodes: RFNode[] = useMemo(() => {
    const byEmp = new Map(data.employees.map((e) => [e.id, e]));
    const byDept = new Map(data.departments.map((d) => [d.id, d]));
    const reportsOf = (id: string) => data.employees.filter((e) => e.managerId === id);
    const list: RFNode[] = [];

    for (const [id, pos] of positions) {
      const kids = childMap.get(id) || [];
      const hasChildren = kids.length > 0;
      const expanded = !collapsed.has(id);

      if (id === "company") {
        list.push({
          id,
          type: "company",
          position: pos,
          draggable: false,
          selectable: false,
          className: hoveredId === id ? "nopan org-node-hovered" : "nopan",
          zIndex: hoveredId === id ? 1000 : 1,
          style: { width: NODE_SIZE.company.width, height: NODE_SIZE.company.height },
          data: {
            kind: "company",
            company: data.company,
            selected: false,
            highlighted: false,
            hasChildren,
            expanded,
            onToggle: toggle,
          },
        });
        continue;
      }

      const emp = byEmp.get(id);
      if (emp) {
        list.push({
          id,
          type: "employee",
          position: pos,
          draggable: false,
          selectable: false,
          className: hoveredId === id ? "nopan org-node-hovered" : "nopan",
          zIndex: hoveredId === id ? 1000 : 2,
          style: { width: NODE_SIZE.employee.width, height: NODE_SIZE.employee.height },
          data: {
            kind: "employee",
            employee: emp,
            selected: false,
            highlighted: false,
            hasChildren,
            expanded,
            reports: reportsOf(emp.id),
            onToggle: toggle,
            onOpen: openProfile,
          },
        });
        continue;
      }

      const dept = byDept.get(id);
      if (dept) {
        const colorIndex = data.departments.findIndex((d) => d.id === dept.id);
        list.push({
          id,
          type: "department",
          position: pos,
          draggable: false,
          selectable: false,
          className: hoveredId === id ? "nopan org-node-hovered" : "nopan",
          zIndex: hoveredId === id ? 1000 : 2,
          style: { width: NODE_SIZE.department.width, height: NODE_SIZE.department.height },
          data: {
            kind: "department",
            department: {
              ...dept,
              employeeCount: (childMap.get(dept.id) || []).filter((cid) => byEmp.has(cid)).length || dept.employeeCount,
            },
            colorIndex: colorIndex < 0 ? 0 : colorIndex,
            selected: false,
            highlighted: false,
            hasChildren,
            expanded,
            onToggle: toggle,
            onOpen: toggle,
          } satisfies DepartmentNodeData,
        });
      }
    }
    return list;
  }, [positions, childMap, collapsed, data, openProfile, toggle, hoveredId]);

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (const [parent, kids] of childMap) {
      if (collapsed.has(parent)) continue;
      for (const child of kids) {
        if (!positions.has(parent) || !positions.has(child)) continue;
        if (!linkedEdges.has(`${parent}->${child}`)) continue;
        result.push({
          id: `${parent}-${child}`,
          source: parent,
          target: child,
          type: "smoothstep",
          style: { stroke: GOLD, strokeWidth: 1.8 },
        });
      }
    }
    return result;
  }, [childMap, collapsed, linkedEdges, positions]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <OrgChartToolbar view={view} onView={changeView} />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F9FC]">
        <ReactFlowProvider>
          <OrgChartCanvas
            nodes={nodes}
            edges={edges}
            view={view}
            onEmployeeClick={openProfile}
            onHoverNode={setHoveredId}
          />
        </ReactFlowProvider>
      </div>
      <style>{`
        .org-chart-canvas,
        .org-chart-canvas .react-flow__pane {
          cursor: default !important;
        }
        .org-chart-canvas .react-flow__pane.dragging {
          cursor: grab !important;
        }
        .org-chart-canvas .react-flow__node,
        .org-chart-canvas .react-flow__node button {
          cursor: pointer !important;
        }
        .org-chart-canvas .react-flow__node {
          pointer-events: all !important;
          padding: 0;
          border: none;
          background: transparent;
          box-shadow: none;
          overflow: visible;
        }
        .org-chart-canvas .react-flow__node:hover,
        .org-chart-canvas .react-flow__node.org-node-hovered {
          z-index: 1000 !important;
        }
        .org-chart-canvas .react-flow__node button {
          pointer-events: auto !important;
        }
        .org-chart-canvas .react-flow__viewport {
          overflow: visible;
        }
        .org-chart-canvas .react-flow__handle {
          width: 8px;
          height: 8px;
          border: none;
          background: #C9962A;
          opacity: 0;
        }
        .org-chart-canvas .react-flow__edge-path {
          stroke: #C9962A;
          stroke-width: 1.8;
        }
        .org-chart-canvas .react-flow__controls {
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
          overflow: hidden;
          border-radius: 12px;
        }
        .org-chart-canvas .react-flow__panel.bottom.right {
          margin: 12px;
        }
      `}</style>
    </div>
  );
}

export type { OrgChartData, Employee };
