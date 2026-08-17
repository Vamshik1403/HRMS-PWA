import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { AttendanceRegularisationManagement } from "../../attendance-regularisation/AttendanceRegularisationManagement";

/** Emp-portal entry for attendance regularisation (keeps manager sidebar chrome). */
export default function EmpTeamRegularisationPage() {
  return (
    <EmpMobileLayout>
      <div className="emp-portal-embedded-admin -mx-2 lg:-mx-4">
        <AttendanceRegularisationManagement />
      </div>
    </EmpMobileLayout>
  );
}
