import { AttendanceReportsManagement } from './AttendanceReportsManagement'
import { PageLayout } from "../components/layout/PageLayout";

export default function AttendanceReportsPage() {
  return (
    <PageLayout>
      <AttendanceReportsManagement mode="actual" />
    </PageLayout>
  )
}
