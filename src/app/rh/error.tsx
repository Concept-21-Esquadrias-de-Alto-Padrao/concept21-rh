"use client";

import { ErrorState } from "@/modules/hr/components/ErrorState";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <ErrorState message={toUserFriendlyErrorMessage(error)} />;
}
