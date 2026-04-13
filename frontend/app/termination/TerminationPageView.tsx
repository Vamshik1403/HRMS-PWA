"use client";

import { useEffect, useMemo, useState } from "react";
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
  CalendarDays,
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
  createdAt: string;
  employee?: Employee;
}

const API = {
  employees: "/backend/manage-emp",
  terminations: "/backend/termination",
};

export default function TerminationManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER" || user?.role === "COMPANY_ADMIN";

  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState("");

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
  });

  // -------------------
  // Load Data
  // -------------------
  const fetchData = async () => {
    try {
      setLoading(true);

      const empRes = await fetch(`${API.employees}?status=ACTIVE`);
      const empRaw = await empRes.json();
      const empData = Array.isArray(empRaw) ? empRaw : empRaw?.data ?? [];
      setEmployees(empData);

      const termRes = await fetch(API.terminations);
      const raw = await termRes.json();
      const termData = Array.isArray(raw) ? raw : raw?.data ?? [];
      setTerminations(termData);
    } catch (e) {
      console.error("Load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -------------------
  // Initiate Exit
  // -------------------
  const handleCreate = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    try {
      await fetch(API.terminations, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          exitType: form.exitType,
          reasonCategory: form.reasonCategory,
          resignationDate: form.resignationDate || undefined,
        }),
      });

      setIsAdding(false);
      setForm({
        employeeId: "",
        exitType: "",
        reasonCategory: "",
        resignationDate: "",
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

      {/* Gradient Header */}
      <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl shadow">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            Employee Exit Management
          </h1>
          <p className="text-sm opacity-80">
            Manage resignation, termination & settlement workflow
          </p>
        </div>

        {canManage && !isAdding && (
          <Button
            className="bg-white text-blue-600 hover:bg-gray-100"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Initiate Exit
          </Button>
        )}
      </div>

      {/* Create Form */}
      {isAdding && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle>Initiate Exit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Employee *</Label>
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm({ ...form, employeeId: e.target.value })
                  }
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeFirstName} {e.employeeLastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Exit Type *</Label>
                <select
                  value={form.exitType}
                  onChange={(e) =>
                    setForm({ ...form, exitType: e.target.value })
                  }
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
                  <TableHead>Last Working Day</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((t) => (
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
                      {t.lastWorkingDay
                        ? new Date(t.lastWorkingDay).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell className="text-right space-x-2">
                      {t.exitStatus === "DRAFT" && (
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
                ))}
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
