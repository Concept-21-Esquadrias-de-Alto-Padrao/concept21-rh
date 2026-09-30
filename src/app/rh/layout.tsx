import type { PropsWithChildren } from "react";

import { AppShell } from "@/modules/hr/components/AppShell";
import { AuthGate } from "@/modules/hr/components/AuthGate";

export default function HrLayout({ children }: PropsWithChildren) {
  return (
    <AppShell>
      <AuthGate>{children}</AuthGate>
    </AppShell>
  );
}
