import type {
  AlertRule,
  AccessReviewRequest,
  AuditLog,
  CompanyUnit,
  CostCenter,
  CostComponent,
  CostComponentCategory,
  CustomField,
  CustomFieldOption,
  CustomFieldValue,
  Department,
  DocumentType,
  Employee,
  EmployeeAddress,
  EmployeeCompensation,
  EmployeeCostComponent,
  EmployeeDocument,
  EmployeeHistoryEvent,
  EmployeeLeave,
  EmployeeMovement,
  EmployeeMovementCostItem,
  EmployeeMonthlyCostEvent,
  EmployeeOccurrence,
  EmployeeStatus,
  EmployeeTraining,
  EmploymentType,
  EmailNotificationQueueItem,
  LeaveType,
  OccurrenceCategory,
  OccurrenceCostRule,
  OccurrenceType,
  Permission,
  PlatformNotification,
  Position,
  Profile,
  RequiredDocument,
  Role,
  RolePermission,
  TerminationReason,
  Training,
  UserRole,
  Vacation,
  MonthlyEmployeeCost,
  MonthlyEmployeeCostItem,
} from "@/modules/hr/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<Profile>;
      company_units: TableDefinition<CompanyUnit>;
      departments: TableDefinition<Department>;
      cost_centers: TableDefinition<CostCenter>;
      cost_component_categories: TableDefinition<CostComponentCategory>;
      cost_components: TableDefinition<CostComponent>;
      positions: TableDefinition<Position>;
      employment_types: TableDefinition<EmploymentType>;
      employee_statuses: TableDefinition<EmployeeStatus>;
      termination_reasons: TableDefinition<TerminationReason>;
      employees: TableDefinition<Employee>;
      employee_addresses: TableDefinition<EmployeeAddress>;
      employee_compensations: TableDefinition<EmployeeCompensation>;
      employee_cost_components: TableDefinition<EmployeeCostComponent>;
      employee_movements: TableDefinition<EmployeeMovement>;
      employee_movement_cost_items: TableDefinition<EmployeeMovementCostItem>;
      employee_monthly_cost_events: TableDefinition<EmployeeMonthlyCostEvent>;
      monthly_employee_costs: TableDefinition<MonthlyEmployeeCost>;
      monthly_employee_cost_items: TableDefinition<MonthlyEmployeeCostItem>;
      document_types: TableDefinition<DocumentType>;
      required_documents: TableDefinition<RequiredDocument>;
      employee_documents: TableDefinition<EmployeeDocument>;
      vacations: TableDefinition<Vacation>;
      leave_types: TableDefinition<LeaveType>;
      employee_leaves: TableDefinition<EmployeeLeave>;
      trainings: TableDefinition<Training>;
      employee_trainings: TableDefinition<EmployeeTraining>;
      occurrence_categories: TableDefinition<OccurrenceCategory>;
      occurrence_types: TableDefinition<OccurrenceType>;
      occurrence_cost_rules: TableDefinition<OccurrenceCostRule>;
      employee_occurrences: TableDefinition<EmployeeOccurrence>;
      roles: TableDefinition<Role>;
      permissions: TableDefinition<Permission>;
      role_permissions: TableDefinition<RolePermission>;
      user_roles: TableDefinition<UserRole>;
      custom_fields: TableDefinition<CustomField>;
      custom_field_options: TableDefinition<CustomFieldOption>;
      custom_field_values: TableDefinition<CustomFieldValue>;
      alert_rules: TableDefinition<AlertRule>;
      audit_logs: TableDefinition<AuditLog>;
      employee_history_events: TableDefinition<EmployeeHistoryEvent>;
      access_review_requests: TableDefinition<AccessReviewRequest>;
      platform_notifications: TableDefinition<PlatformNotification>;
      email_notification_queue: TableDefinition<EmailNotificationQueueItem>;
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: {
        Args: { permission_key: string };
        Returns: boolean;
      };
      permission_scope: {
        Args: { permission_key: string };
        Returns: string;
      };
      current_auth_email_confirmed: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      request_access_review: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
