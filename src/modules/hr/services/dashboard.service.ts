import { addDaysIsoDate, getHrSupabaseClient, todayIsoDate } from "@/modules/hr/services/service-utils";

export interface HrDashboardMetric {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}

export interface HrDashboardOverview {
  metrics: HrDashboardMetric[];
  expiredDocuments: Array<{ id: string; employee: string; document: string; expirationDate: string }>;
  expiringDocuments: Array<{ id: string; employee: string; document: string; expirationDate: string }>;
  upcomingBirthdays: Array<{ id: string; name: string; birthDate: string }>;
  activeVacations: Array<{ id: string; employee: string; start: string; end: string }>;
  activeLeaves: Array<{ id: string; employee: string; start: string; end?: string | null }>;
  expiringTrainings: Array<{ id: string; employee: string; training: string; expirationDate: string }>;
}

export async function getHrDashboardOverview(): Promise<HrDashboardOverview> {
  const supabase = getHrSupabaseClient();
  const today = todayIsoDate();
  const soon = addDaysIsoDate(30);
  const monthStart = today.slice(0, 8) + "01";

  const [employeesResult, documentsResult, vacationsResult, leavesResult, trainingsResult] =
    await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, birth_date, hire_date, termination_date, status:employee_statuses(key, name)")
        .is("deleted_at", null),
      supabase
        .from("employee_documents")
        .select("id, expiration_date, status, employee:employees(full_name), document_type:document_types(name)")
        .is("deleted_at", null),
      supabase
        .from("vacations")
        .select("id, vacation_start, vacation_end, status, employee:employees(full_name)")
        .is("deleted_at", null),
      supabase
        .from("employee_leaves")
        .select("id, start_date, end_date, status, employee:employees(full_name)")
        .is("deleted_at", null),
      supabase
        .from("employee_trainings")
        .select("id, expiration_date, status, employee:employees(full_name), training:trainings(name)")
        .is("deleted_at", null),
    ]);

  const firstError =
    employeesResult.error ??
    documentsResult.error ??
    vacationsResult.error ??
    leavesResult.error ??
    trainingsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const employees = (employeesResult.data ?? []) as unknown as Array<{
    id: string;
    full_name: string;
    birth_date?: string | null;
    hire_date?: string | null;
    termination_date?: string | null;
    status?: { key?: string | null; name?: string | null } | null;
  }>;
  const documents = (documentsResult.data ?? []) as unknown as Array<{
    id: string;
    expiration_date?: string | null;
    status: string;
    employee?: { full_name?: string | null } | null;
    document_type?: { name?: string | null } | null;
  }>;
  const vacations = (vacationsResult.data ?? []) as unknown as Array<{
    id: string;
    vacation_start: string;
    vacation_end: string;
    status: string;
    employee?: { full_name?: string | null } | null;
  }>;
  const leaves = (leavesResult.data ?? []) as unknown as Array<{
    id: string;
    start_date: string;
    end_date?: string | null;
    status: string;
    employee?: { full_name?: string | null } | null;
  }>;
  const trainings = (trainingsResult.data ?? []) as unknown as Array<{
    id: string;
    expiration_date?: string | null;
    status: string;
    employee?: { full_name?: string | null } | null;
    training?: { name?: string | null } | null;
  }>;

  const activeEmployees = employees.filter((employee) => employee.status?.key === "ativo");
  const inactiveEmployees = employees.filter((employee) =>
    ["inativo", "desligado"].includes(employee.status?.key ?? ""),
  );
  const trialEmployees = employees.filter((employee) => employee.status?.key === "em_experiencia");
  const vacationEmployees = employees.filter((employee) => employee.status?.key === "em_ferias");
  const leaveEmployees = employees.filter((employee) => employee.status?.key === "afastado");
  const admissionsThisMonth = employees.filter((employee) => employee.hire_date?.startsWith(monthStart.slice(0, 7)));
  const terminationsThisMonth = employees.filter((employee) =>
    employee.termination_date?.startsWith(monthStart.slice(0, 7)),
  );

  const expiredDocuments = documents.filter(
    (document) => document.expiration_date && document.expiration_date < today,
  );
  const expiringDocuments = documents.filter(
    (document) =>
      document.expiration_date &&
      document.expiration_date >= today &&
      document.expiration_date <= soon,
  );
  const pendingDocuments = documents.filter((document) =>
    ["pending", "rejected"].includes(document.status),
  );

  const expiredTrainings = trainings.filter(
    (training) => training.expiration_date && training.expiration_date < today,
  );
  const expiringTrainings = trainings.filter(
    (training) =>
      training.expiration_date &&
      training.expiration_date >= today &&
      training.expiration_date <= soon,
  );

  const currentMonth = new Date().getMonth() + 1;
  const upcomingBirthdays = employees
    .filter((employee) => {
      if (!employee.birth_date) {
        return false;
      }

      return Number(employee.birth_date.slice(5, 7)) === currentMonth;
    })
    .map((employee) => ({
      id: employee.id,
      name: employee.full_name,
      birthDate: employee.birth_date ?? "",
    }))
    .slice(0, 8);

  return {
    metrics: [
      { label: "Colaboradores ativos", value: activeEmployees.length, tone: "success" },
      { label: "Inativos", value: inactiveEmployees.length, tone: "neutral" },
      { label: "Em experiencia", value: trialEmployees.length, tone: "warning" },
      { label: "Em férias", value: vacationEmployees.length, tone: "info" },
      { label: "Afastados", value: leaveEmployees.length, tone: "danger" },
      { label: "Admissoes no mes", value: admissionsThisMonth.length, tone: "info" },
      { label: "Desligamentos no mes", value: terminationsThisMonth.length, tone: "neutral" },
      { label: "Docs pendentes", value: pendingDocuments.length, tone: "warning" },
      { label: "Docs vencidos", value: expiredDocuments.length, tone: "danger" },
      { label: "Docs vencendo", value: expiringDocuments.length, tone: "warning" },
      { label: "Treinamentos vencidos", value: expiredTrainings.length, tone: "danger" },
      { label: "Treinamentos vencendo", value: expiringTrainings.length, tone: "warning" },
      { label: "Aniversariantes", value: upcomingBirthdays.length, tone: "info" },
    ],
    expiredDocuments: expiredDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      employee: document.employee?.full_name ?? "-",
      document: document.document_type?.name ?? "-",
      expirationDate: document.expiration_date ?? "",
    })),
    expiringDocuments: expiringDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      employee: document.employee?.full_name ?? "-",
      document: document.document_type?.name ?? "-",
      expirationDate: document.expiration_date ?? "",
    })),
    upcomingBirthdays,
    activeVacations: vacations
      .filter(
        (vacation) =>
          ["approved", "in_progress"].includes(vacation.status) &&
          vacation.vacation_start <= today &&
          vacation.vacation_end >= today,
      )
      .slice(0, 6)
      .map((vacation) => ({
        id: vacation.id,
        employee: vacation.employee?.full_name ?? "-",
        start: vacation.vacation_start,
        end: vacation.vacation_end,
      })),
    activeLeaves: leaves
      .filter(
        (leave) =>
          ["approved", "in_progress"].includes(leave.status) &&
          leave.start_date <= today &&
          (!leave.end_date || leave.end_date >= today),
      )
      .slice(0, 6)
      .map((leave) => ({
        id: leave.id,
        employee: leave.employee?.full_name ?? "-",
        start: leave.start_date,
        end: leave.end_date,
      })),
    expiringTrainings: expiringTrainings.slice(0, 6).map((training) => ({
      id: training.id,
      employee: training.employee?.full_name ?? "-",
      training: training.training?.name ?? "-",
      expirationDate: training.expiration_date ?? "",
    })),
  };
}
