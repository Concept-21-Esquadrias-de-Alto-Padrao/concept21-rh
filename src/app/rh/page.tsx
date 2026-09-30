import { DashboardPage } from "@/modules/hr/pages/DashboardPage";
import { Suspense } from "react";

export default function HrDashboardRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
