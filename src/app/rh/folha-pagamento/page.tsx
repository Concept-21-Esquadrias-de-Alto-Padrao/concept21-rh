import { PayrollPage } from "@/modules/hr/pages/PayrollPage";
import { Suspense } from "react";

export default function PayrollRoute() {
  return (
    <Suspense fallback={null}>
      <PayrollPage />
    </Suspense>
  );
}
