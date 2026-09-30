import { MovementsPage } from "@/modules/hr/pages/MovementsPage";
import { Suspense } from "react";

export default function MovementsRoute() {
  return (
    <Suspense fallback={null}>
      <MovementsPage />
    </Suspense>
  );
}
