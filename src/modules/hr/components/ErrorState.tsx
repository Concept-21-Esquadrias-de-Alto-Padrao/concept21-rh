import { AlertTriangle } from "lucide-react";

import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  const friendlyMessage = toUserFriendlyErrorMessage(message);

  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
        <div>
          <p className="font-semibold">Não foi possível carregar esta área.</p>
          <p className="mt-1">{friendlyMessage}</p>
        </div>
      </div>
    </div>
  );
}
