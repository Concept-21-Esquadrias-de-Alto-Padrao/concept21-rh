import { OccurrencesPage } from "@/modules/hr/pages/OccurrencesPage";
import { Suspense } from "react";

export default function OccurrencesRoute() {
  return (
    <Suspense fallback={null}>
      <OccurrencesPage />
    </Suspense>
  );
}
