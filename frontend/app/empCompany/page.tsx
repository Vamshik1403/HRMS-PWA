import { redirect } from "next/navigation";

/** Legacy Overview route — Dashboard now lives under My Company tabs. */
export default function EmpCompanyPage() {
  redirect("/empCompanyDashboard");
}
