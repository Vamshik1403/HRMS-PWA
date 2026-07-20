import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmployeesPromotionsManagement } from "../../employees-promotions/EmployeesPromotionsManagement";

export default function EmpTeamPromotionsPage() {
  return (
    <EmpMobileLayout>
      <div className="emp-portal-embedded-admin -mx-2 lg:-mx-4">
        <EmployeesPromotionsManagement embedded />
      </div>
    </EmpMobileLayout>
  );
}
