import { EmployeesPage } from "@/modules/hr/pages/EmployeesPage";
import { Suspense } from "react";

export default function EmployeesRoute() {
  return (
    <Suspense fallback={null}>
      <EmployeesPage />
    </Suspense>
  );
}
