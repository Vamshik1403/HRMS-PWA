import { redirect } from "next/navigation";

/** Legacy Overview route — company hub now lives at /my-company. */
export default function EmpCompanyPage() {
  redirect("/my-company");
}
