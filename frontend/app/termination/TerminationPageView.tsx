"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  Search,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

type ID = number;

interface Employee {
  id: ID;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeeID?: string;
  lifecycleStatus: "ACTIVE" | "EXITED" | "INACTIVE";
}

interface Termination {
  id: ID;
  employeeId: ID;
  exitType: string;
  exitStatus: string;
  reasonCategory?: string;
  lastWorkingDay?: string;
  resignationDate?: string;
  noticeStartDate?: string;
  noticeDays?: number;
  createdAt: string;
  employee?: Employee;
}

const API = {
  employees: "/backend/manage-emp/list",
  terminations: "/backend/termination",
};

const EXIT_TYPES_WITHOUT_NOTICE = new Set(["TERMINATION", "DEATH", "ABSCONDING"]);

function exitTypeRequiresNotice(exitType: string) {
  return Boolean(exitType) && !EXIT_TYPES_WITHOUT_NOTICE.has(exitType);
}

export default function TerminationManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || user?.role === "ADMIN";

  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState("");

  // Employee autocomplete
  const [empSearch, setEmpSearch] = useState("");
  const [empList, setEmpList] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const empTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedTermination, setSelectedTermination] =
    useState<Termination | null>(null);

  const [approvalForm, setApprovalForm] = useState({
    lastWorkingDay: "",
    noticeDays: "",
    disableLoginOn: "",
  });

  const [form, setForm] = useState({
    employeeId: "",
    exitType: "",
    reasonCategory: "",
    resignationDate: "",
    initiatedOn: new Date().toISOString().split("T")[0],
    noticePeriod: "",
  });

  // -------------------
  // Load Data
  // -------------------
  const fetchData = async () => {
    try {
      setLoading(true);

      const empRes = await fetch(`${API.employees}?status=ACTIVE`);
      const empRaw = await empRes.json();
      let empData = Array.isArray(empRaw) ? empRaw : empRaw?.data ?? [];
      // Filter by company from sidebar context
      const ctx = getSidebarContext();
      const companyID = ctx?.companyID ?? user?.companyID;
      if (companyID) {
        empData = empData.filter((e: any) => e.companyID === companyID);
      }
      setEmployees(empData);

      const termRes = await fetch(API.terminations);
      const raw = await termRes.json();
      let termData = Array.isArray(raw) ? raw : raw?.data ?? [];
      if (companyID) {
        termData = termData.filter((t: any) => t.employee?.companyID === companyID || t.companyID === companyID);
      }
      setTerminations(termData);
    } catch (e) {
      console.error("Load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const runFetchEmp = (q: string) => {
    if (empTimerRef.current) clearTimeout(empTimerRef.current);
    empTimerRef.current = setTimeout(() => {
      if (q.length < 1) { setEmpList([]); return; }
      const ql = q.toLowerCase();
      // Exclude employees who already have an active/approved termination
      const activeTerminatedIds = new Set(
        terminations
          .filter((t) => t.exitStatus === "DRAFT" || t.exitStatus === "APPROVED" || t.exitStatus === "NOTICE_RUNNING")
          .map((t) => t.employeeId)
      );
      const filtered = employees.filter((e) => {
        if (activeTerminatedIds.has(e.id)) return false;
        const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.toLowerCase();
        const eid = (e.employeeID ?? "").toLowerCase();
        return name.includes(ql) || eid.includes(ql);
      });
      setEmpList(filtered.slice(0, 20));
    }, 150);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpList([]);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // -------------------
  // Initiate Exit
  // -------------------
  const handleCreate = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    try {
      const requiresNotice = exitTypeRequiresNotice(form.exitType);
      const createRes = await fetch(API.terminations, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          exitType: form.exitType,
          reasonCategory: form.reasonCategory,
          resignationDate: form.resignationDate || undefined,
          noticeStartDate: form.initiatedOn || undefined,
          noticeDays:
            requiresNotice && form.noticePeriod
              ? Number(form.noticePeriod)
              : undefined,
        }),
      });

      const created = await createRes.json();

      // For admin roles, auto-approve immediately — no separate approval step needed
      if (canManage && created?.id) {
        let lastWorkingDay: string;
        if (requiresNotice && form.noticePeriod) {
          const noticeDays = Number(form.noticePeriod);
          const startDate = form.initiatedOn
            ? new Date(form.initiatedOn)
            : new Date();
          startDate.setDate(startDate.getDate() + noticeDays);
          lastWorkingDay = startDate.toISOString().split("T")[0];
        } else {
          lastWorkingDay =
            form.initiatedOn || new Date().toISOString().split("T")[0];
        }

        await fetch(`${API.terminations}/${created.id}/approve`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastWorkingDay }),
        });
      }

      setIsAdding(false);
      setEmpSearch("");
      setForm({
        employeeId: "",
        exitType: "",
        reasonCategory: "",
        resignationDate: "",
        initiatedOn: new Date().toISOString().split("T")[0],
        noticePeriod: "",
      });
      fetchData();
    } catch {
      alert("Failed to initiate termination");
    } finally {
      setSaving(false);
    }
  };

  // -------------------
  // Approval Modal Logic
  // -------------------
  const openApproveModal = (termination: Termination) => {
    setSelectedTermination(termination);
    setApproveModalOpen(true);
  };

  const confirmApprove = async () => {
    if (!approvalForm.lastWorkingDay) {
      alert("Last working day required");
      return;
    }

    await fetch(`${API.terminations}/${selectedTermination?.id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastWorkingDay: approvalForm.lastWorkingDay,
        noticeDays: approvalForm.noticeDays
          ? Number(approvalForm.noticeDays)
          : undefined,
        disableLoginOn:
          approvalForm.disableLoginOn || approvalForm.lastWorkingDay,
      }),
    });

    setApproveModalOpen(false);
    setSelectedTermination(null);
    setApprovalForm({
      lastWorkingDay: "",
      noticeDays: "",
      disableLoginOn: "",
    });

    fetchData();
  };

  const handleCancel = async (id: ID) => {
    await fetch(`${API.terminations}/${id}/cancel`, {
      method: "PUT",
    });
    fetchData();
  };

  const handleFinal = async (id: ID) => {
    await fetch(`${API.terminations}/${id}/final-settle`, {
      method: "PUT",
    });
    fetchData();
  };

  // -------------------
  // Search
  // -------------------
  const filtered = useMemo(() => {
    if (!Array.isArray(terminations)) return [];
    if (!search) return terminations;

    return terminations.filter((t) =>
      `${t.employee?.employeeFirstName} ${t.employee?.employeeLastName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search, terminations]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">

      {canManage && !isAdding && (
        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Initiate Off Boarding
          </Button>
        </div>
      )}

      {/* Create Form */}
      {isAdding && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle>Initiate Exit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div ref={empRef} className="relative">
                <Label>Employee *</Label>
                <Input
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    setForm({ ...form, employeeId: "" });
                    runFetchEmp(e.target.value);
                  }}
                  onFocus={(e) => { if (e.target.value.length >= 1) runFetchEmp(e.target.value); }}
                  placeholder="Type employee name or ID…"
                  autoComplete="off"
                  required={!form.employeeId}
                />
                {empList.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
                    {empList.map((e) => (
                      <div
                        key={e.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setForm({ ...form, employeeId: String(e.id) });
                          setEmpSearch(`${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""} - ${e.employeeID ?? ""}`.trim());
                          setEmpList([]);
                        }}
                      >
                        {e.employeeFirstName ?? ""} {e.employeeLastName ?? ""} - {e.employeeID ?? ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Exit Type *</Label>
                <select
                  value={form.exitType}
                  onChange={(e) => {
                    const exitType = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      exitType,
                      noticePeriod: EXIT_TYPES_WITHOUT_NOTICE.has(exitType)
                        ? ""
                        : prev.noticePeriod,
                    }));
                  }}
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="RESIGNATION">Resignation</option>
                  <option value="TERMINATION">Termination</option>
                  <option value="RETRENCHMENT">Retrenchment</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="DEATH">Death</option>
                  <option value="ABSCONDING">Absconding</option>
                  <option value="CONTRACT_END">Contract End</option>
                </select>
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  value={form.reasonCategory}
                  onChange={(e) =>
                    setForm({ ...form, reasonCategory: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Initiated On</Label>
                <Input
                  type="date"
                  value={form.initiatedOn}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setForm({ ...form, initiatedOn: e.target.value })
                  }
                />
              </div>

              {exitTypeRequiresNotice(form.exitType) && (
                <div>
                  <Label>Notice Period (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.noticePeriod}
                    onChange={(e) =>
                      setForm({ ...form, noticePeriod: e.target.value })
                    }
                    placeholder="e.g. 30"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : "Submit"}
                </Button>
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Termination List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Exit Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated On</TableHead>
                  <TableHead>Notice Period</TableHead>
                  <TableHead>Last Working Day</TableHead>
                  <TableHead>Employee Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableBodySkeleton cols={8} />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No termination records found
                    </TableCell>
                  </TableRow>
                ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.employee?.employeeFirstName}{" "}
                      {t.employee?.employeeLastName}
                    </TableCell>

                    <TableCell>{t.exitType}</TableCell>

                    <TableCell>
                      <Badge
                        className={
                          t.exitStatus === "DRAFT"
                            ? "bg-yellow-100 text-yellow-700"
                            : t.exitStatus === "APPROVED"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }
                      >
                        {t.exitStatus}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {t.noticeStartDate
                        ? new Date(t.noticeStartDate).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell>
                      {t.noticeDays != null ? `${t.noticeDays} days` : "-"}
                    </TableCell>

                    <TableCell>
                      {t.lastWorkingDay
                        ? new Date(t.lastWorkingDay).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell>
                      {(() => {
                        if (t.exitStatus === "FINAL_SETTLED" || t.exitStatus === "APPROVED") {
                          return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
                        }
                        if (t.exitStatus === "CANCELLED" || t.exitStatus === "WITHDRAWN") {
                          return <Badge className="bg-green-100 text-green-700">Active</Badge>;
                        }
                        if (t.noticeStartDate && t.noticeDays) {
                          const end = new Date(t.noticeStartDate);
                          end.setDate(end.getDate() + t.noticeDays);
                          if (new Date() >= end) {
                            return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
                          }
                          return <Badge className="bg-orange-100 text-orange-700">Notice Period</Badge>;
                        }
                        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
                      })()}
                    </TableCell>

                    <TableCell className="text-right space-x-2">
                      {t.exitStatus === "DRAFT" && !canManage && (
                        <>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => openApproveModal(t)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(t.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {t.exitStatus === "DRAFT" && canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(t.id)}
                        >
                          Cancel
                        </Button>
                      )}

                      {t.exitStatus === "APPROVED" && (
                        <Button
                          size="sm"
                          onClick={() => handleFinal(t.id)}
                        >
                          Final Settle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Approval Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <CheckCircle2 className="w-5 h-5" />
              Approve Termination
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Last Working Day *</Label>
              <Input
                type="date"
                value={approvalForm.lastWorkingDay}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    lastWorkingDay: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label>Notice Days</Label>
              <Input
                type="number"
                value={approvalForm.noticeDays}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    noticeDays: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label>Disable Login On</Label>
              <Input
                type="date"
                value={approvalForm.disableLoginOn}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    disableLoginOn: e.target.value,
                  })
                }
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              Approving will disable login and mark employee as EXITED.
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmApprove}
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
