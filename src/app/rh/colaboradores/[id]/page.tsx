import { EmployeeProfilePage } from "@/modules/hr/pages/EmployeeProfilePage";

export default async function EmployeeProfileRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeProfilePage employeeId={id} />;
}
