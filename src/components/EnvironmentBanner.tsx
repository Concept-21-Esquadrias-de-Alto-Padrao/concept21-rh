import { FlaskConical } from "lucide-react";

import { getDeploymentEnvironment } from "@/lib/environment";

export function EnvironmentBanner() {
  if (!getDeploymentEnvironment().isHomologation) {
    return null;
  }

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex h-12 flex-wrap content-center items-center justify-center gap-x-3 border-b border-amber-300 bg-amber-100 px-4 text-center text-xs text-amber-950 sm:text-sm">
      <span className="inline-flex items-center gap-2 font-bold">
        <FlaskConical aria-hidden="true" className="h-4 w-4" />
        AMBIENTE DE TESTE
      </span>
      <span>Dados fictícios. Comunicações externas bloqueadas.</span>
    </div>
  );
}
