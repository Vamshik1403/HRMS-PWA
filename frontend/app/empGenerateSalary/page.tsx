import { Suspense } from "react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpGenerateSalary } from "./EmpGenerateSalaryPage";

/** PWA Pay Slips list (employees + admins on mobile). */
export default function EmpGenerateSalaryPage() {
  return (
    <EmpMobileLayout>
      <Suspense fallback={null}>
        <EmpGenerateSalary />
      </Suspense>
    </EmpMobileLayout>
  );
}
