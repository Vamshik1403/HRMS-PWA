"use client"
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import EmpLayout from "../components/layout/EmpLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";

const cardShell =
  "bg-white rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.05)] border border-[#d1d5db]";

interface Employee {
  id: number;
  serviceProviderID: number;
  companyID: number;
  branchesID: number;
  employeeFirstName: string;
  employeeLastName: string;
  employeePhoto?: string;
}

interface AttendanceLog {
  id: number;
  employeeID: number;
  punchTimeStamp: string;
}

interface Department {
  id: number;
  companyID: number;
  branchesID: number;
  departmentName?: string | null;
}

export default function Page() {
  const user = useCurrentUser();
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [todayDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [empRes, deptRes, attRes] = await Promise.all([
        fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/emp-attendance-logs`, { cache: "no-store" }),
      ]);

      const empJson = await empRes.json();
      const allEmployees: Employee[] = Array.isArray(empJson) ? empJson : [];
      const deptJson = await deptRes.json();
      const allDepartments: Department[] = Array.isArray(deptJson) ? deptJson : [];
      const attJson = await attRes.json();
      const allAttendance: AttendanceLog[] = Array.isArray(attJson) ? attJson : [];

      // Scope to employee's company/branch
      const scopedEmployees = allEmployees.filter(
        (e) => e.companyID === user!.companyID && e.branchesID === user!.branchesID
      );
      const scopedDepartments = allDepartments.filter(
        (d) => d.companyID === user!.companyID && d.branchesID === user!.branchesID
      );

      setEmployees(scopedEmployees);
      setDepartments(scopedDepartments);

      const todayLogs = allAttendance.filter((log) => {
        const date = log.punchTimeStamp.split(" ")[0];
        return date === todayDate && scopedEmployees.some((e) => e.id === log.employeeID);
      });

      const presentIds = new Set(todayLogs.map((l) => l.employeeID));
      setPresentCount(presentIds.size);
      setAttendanceLogs(todayLogs);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
};

  const getAttendance = (empId: number) => {
    const logs = attendanceLogs
      .filter((l) => l.employeeID === empId)
      .sort((a, b) => new Date(a.punchTimeStamp).getTime() - new Date(b.punchTimeStamp).getTime());
    if (logs.length === 0) return { inTime: "N/A", outTime: "N/A" };
    return {
      inTime: logs[0].punchTimeStamp.split(" ")[1]?.slice(0, 5) || "N/A",
      outTime: logs.length > 1 ? logs[logs.length - 1].punchTimeStamp.split(" ")[1]?.slice(0, 5) : "N/A",
    };
  };

  const absentCount = Math.max(0, employees.length - presentCount);
  const attRate = employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0;
  const absentRate = employees.length > 0 ? Math.round((absentCount / employees.length) * 100) : 0;

  if (!user || loading) {
    return (
      <EmpLayout>
        <div className="space-y-5 animate-pulse">
          <div className={`${cardShell} p-6 h-32`} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={`lg:col-span-2 ${cardShell} p-6 h-72`} />
            <div className={`${cardShell} p-6 h-72`} />
          </div>
        </div>
      </EmpLayout>
    );
  }

  return (
    <EmpLayout>
      <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon icon="mdi:view-dashboard" className="w-5 h-5 text-[#4f46e5]" />
        <h1 className="text-lg font-bold text-[#111827] tracking-tight">Dashboard</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Employee */}
        <div className="rounded-2xl border border-[#d1d5db] bg-white p-5">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                <Icon icon="mdi:account-group" className="w-5 h-5 text-[#4f46e5]" />
              </div>
              <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">Total</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-[#111827]">{employees.length}</p>
            <p className="text-[13px] font-medium text-gray-500 mt-1">Total employees</p>
          </div>
        </div>

        {/* Department */}
        <div className="rounded-2xl border border-[#d1d5db] bg-white p-5">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                <Icon icon="mdi:office-building-outline" className="w-5 h-5 text-[#4f46e5]" />
              </div>
              <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">Dept</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-[#111827]">{departments.length}</p>
            <p className="text-[13px] font-medium text-gray-500 mt-1">Departments</p>
          </div>
        </div>

        {/* Present */}
        <div className="rounded-2xl border border-[#d1d5db] bg-white p-5">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                <Icon icon="mdi:account-check" className="w-5 h-5 text-[#4f46e5]" />
              </div>
              <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">{attRate}%</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-[#111827]">{presentCount}</p>
            <p className="text-[13px] font-medium text-gray-500 mt-1">Present today</p>
          </div>
        </div>

        {/* Absent */}
        <div className="rounded-2xl border border-[#d1d5db] bg-white p-5">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#eef2ff] flex items-center justify-center">
                <Icon icon="mdi:account-remove" className="w-5 h-5 text-[#4f46e5]" />
              </div>
              <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2.5 py-1 rounded-full">{absentRate}%</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-[#111827]">{absentCount}</p>
            <p className="text-[13px] font-medium text-gray-500 mt-1">Absent today</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Today Attendance */}
          <section className={`${cardShell} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-4">Today Attendance</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Photo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>In time</TableHead>
                    <TableHead>Out Time</TableHead>
                    <TableHead>Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.filter(e => {
                    const presentIds = new Set(attendanceLogs.map(l => l.employeeID));
                    return presentIds.has(e.id);
                  }).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.filter(e => {
                      const presentIds = new Set(attendanceLogs.map(l => l.employeeID));
                      return presentIds.has(e.id);
                    }).map((emp, idx) => {
                      const att = getAttendance(emp.id);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                              {emp.employeeFirstName?.charAt(0) || "?"}
                            </div>
                          </TableCell>
                          <TableCell>{emp.employeeFirstName} {emp.employeeLastName}</TableCell>
                          <TableCell>{att.inTime}</TableCell>
                          <TableCell>{att.outTime}</TableCell>
                          <TableCell>—</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
          </section>

          {/* Check In/Out */}
          <section className={`${cardShell} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-4">
                HEY ADMIN PLEASE CHECK IN/OUT YOUR ATTENDANCE
              </h2>
              <div className="space-y-4">
                <p className="text-[13px] text-gray-500">Your IP is 49.36.9.26</p>
                <Button className="px-6 py-2">
                  <Icon icon="mdi:clock-check-outline" className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              </div>
          </section>
        </div>

        {/* Notice Board */}
        <div>
          <section className={`${cardShell} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-5">NOTICE BOARD</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon icon="mdi:flag" className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm mb-1">Meeting..</h3>
                    <p className="text-[12px] text-gray-500 mb-0.5">
                      Published Date: 12 Mar 2026
                    </p>
                    <p className="text-[12px] text-gray-500">Publish By: Admin</p>
                    <p className="text-[12px] text-gray-500 mt-2">Description</p>
                  </div>
                </div>
              </div>
          </section>
        </div>
      </div>
      </div>
</EmpLayout>
  );
}