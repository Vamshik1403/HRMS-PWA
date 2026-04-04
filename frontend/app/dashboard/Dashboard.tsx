"use client";

import { Icon } from "@iconify/react";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/app/components/ui/table";
import { useEffect, useState } from "react";
import { useCurrentUser} from "../hooks/useCurrentUser";

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
}

export default function DashboardPage() {
  const user = useCurrentUser();


  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [todayDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  /* 🔑 LOAD MANAGER MAPPING (EXACT SAME AS AttendancePolicyManagement) */
  useEffect(() => {
    if (user?.role !== "MANAGER") return;

    (async () => {
      const res = await fetch(`${BACKEND_URL}/users`, { cache: "no-store" });
      const users = await res.json();
      const me = users.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user]);

  


  /* 🚀 LOAD DASHBOARD DATA */
  useEffect(() => {
    if (!user) return;
    if (user.role === "MANAGER" && !currentUserMapping) return;

    loadDashboard();
  }, [user, currentUserMapping]);


      if (!user) {
  return (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <div className="text-gray-500">Loading user session…</div>
    </div>
  );
}


  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [empRes, deptRes, attRes] = await Promise.all([
        fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/departments`, { cache: "no-store" }),
        fetch(`${BACKEND_URL}/emp-attendance-logs`, { cache: "no-store" }),
      ]);

      const allEmployees: Employee[] = await empRes.json();
      const allDepartments: Department[] = await deptRes.json();
      const allAttendance: AttendanceLog[] = await attRes.json();

      let scopedEmployees: Employee[] = [];
      let scopedDepartments: Department[] = [];

      /* 🟢 SUPERADMIN → ALL */
      if (user.role === "SUPERADMIN") {
        scopedEmployees = allEmployees;
        scopedDepartments = allDepartments;
      }

      /* 🟡 MANAGER → company + branch from /users */
      else if (user.role === "MANAGER" && currentUserMapping) {
        scopedEmployees = allEmployees.filter(
          (e) =>
            e.companyID === currentUserMapping.companyID &&
            e.branchesID === currentUserMapping.branchesID
        );

        scopedDepartments = allDepartments.filter(
          (d) =>
            d.companyID === currentUserMapping.companyID &&
            d.branchesID === currentUserMapping.branchesID
        );
      }

      /* 🔵 EMPLOYEE → own branch */
      else if (user.role === "EMPLOYEE") {
        scopedEmployees = allEmployees.filter(
          (e) =>
            e.companyID === user.companyID &&
            e.branchesID === user.branchesID
        );

        scopedDepartments = allDepartments.filter(
          (d) =>
            d.companyID === user.companyID &&
            d.branchesID === user.branchesID
        );
      }

      setEmployees(scopedEmployees);
      setDepartmentsCount(scopedDepartments.length);

      /* 📅 TODAY ATTENDANCE */
      const todayLogs = allAttendance.filter((log) => {
        const date = log.punchTimeStamp.split(" ")[0];
        return (
          date === todayDate &&
          scopedEmployees.some((e) => e.id === log.employeeID)
        );
      });

      const presentIds = new Set(todayLogs.map((l) => l.employeeID));
      setPresentCount(presentIds.size);
      setAbsentCount(scopedEmployees.length - presentIds.size);
      setAttendanceLogs(todayLogs);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* 🧠 HELPERS */
  const getAttendance = (empId: number) => {
    const logs = attendanceLogs
      .filter((l) => l.employeeID === empId)
      .sort(
        (a, b) =>
          new Date(a.punchTimeStamp).getTime() -
          new Date(b.punchTimeStamp).getTime()
      );

    if (logs.length === 0)
      return { inTime: "N/A", outTime: "N/A", isPresent: false };

    return {
      inTime: logs[0].punchTimeStamp.split(" ")[1]?.slice(0, 5) || "N/A",
      outTime:
        logs.length > 1
          ? logs[logs.length - 1].punchTimeStamp.split(" ")[1]?.slice(0, 5)
          : "N/A",
      isPresent: true,
    };
  };

  if (!user || loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <Icon icon="mdi:view-dashboard" className="w-5 h-5 text-blue-500" />
        <h1 className="text-lg font-medium text-blue-500">Dashboard</h1>
        <span className="ml-4 px-3 py-1 bg-gray-100 rounded text-sm text-gray-600">
          Role: {user.role} | Company:{" "}
          {user.role === "SUPERADMIN"
            ? "All"
            : currentUserMapping?.companyID ?? user.companyID ?? "—"}{" "}
          | Branch:{" "}
          {user.role === "SUPERADMIN"
            ? "All"
            : currentUserMapping?.branchesID ?? user.branchesID ?? "—"}
        </span>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Stat title="TOTAL EMPLOYEES" value={employees.length} />
        <Stat title="DEPARTMENTS" value={departmentsCount} />
        <Stat title="PRESENT" value={presentCount} />
        <Stat title="ABSENT" value={absentCount} />
      </div>

      {/* TABLE */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4">
            Today Attendance ({todayDate})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e, i) => {
                const a = getAttendance(e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      {e.employeeFirstName} {e.employeeLastName}
                    </TableCell>
                    <TableCell>{a.inTime}</TableCell>
                    <TableCell>{a.outTime}</TableCell>
                    <TableCell>
                      {a.isPresent ? "Present" : "Absent"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* 🔹 SMALL STAT CARD */
function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-blue-600">{value}</p>
      </CardContent>
    </Card>
  );
}
