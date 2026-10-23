import { notFound } from "next/navigation";

import { getDeploymentEnvironment } from "@/lib/environment";
import { AccountPasswordPage } from "@/modules/hr/pages/AccountPasswordPage";

export default function AccountRoute() {
  if (!getDeploymentEnvironment().isHomologation) notFound();
  return <AccountPasswordPage />;
}
