export type ID = string;
export type ISODate = string;
export type Timestamp = string;
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export interface Auditable {
  created_at: Timestamp;
  updated_at?: Timestamp;
  created_by?: ID | null;
  updated_by?: ID | null;
}

export interface Activatable {
  is_active: boolean;
}

export interface LookupRecord extends Auditable, Activatable {
  id: ID;
  name: string;
  key: string;
  description?: string | null;
  sort_order?: number;
}

export interface Profile extends Activatable {
  id: ID;
  auth_user_id: ID | null;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  phone?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type AccessReviewStatus = "pending" | "approved" | "rejected";

export interface AccessReviewRequest {
  id: ID;
  profile_id: ID;
  auth_user_id: ID;
  email: string;
  full_name: string;
  phone?: string | null;
  status: AccessReviewStatus;
  requested_at: Timestamp;
  email_confirmed_at?: Timestamp | null;
  reviewed_at?: Timestamp | null;
  reviewed_by?: ID | null;
  reviewer_notes?: string | null;
  metadata: Record<string, JsonValue>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PlatformNotification {
  id: ID;
  recipient_profile_id?: ID | null;
  recipient_auth_user_id?: ID | null;
  title: string;
  body: string;
  category: string;
  entity?: string | null;
  entity_id?: ID | null;
  action_url?: string | null;
  read_at?: Timestamp | null;
  metadata: Record<string, JsonValue>;
  created_at: Timestamp;
}

export type EmailNotificationStatus = "queued" | "sent" | "failed" | "provider_not_configured";

export interface EmailNotificationQueueItem {
  id: ID;
  recipient_email: string;
  recipient_name?: string | null;
  subject: string;
  body: string;
  status: EmailNotificationStatus;
  provider?: string | null;
  provider_response?: Record<string, JsonValue> | null;
  error_message?: string | null;
  metadata: Record<string, JsonValue>;
  created_at: Timestamp;
  sent_at?: Timestamp | null;
}

export interface CompanyUnit extends LookupRecord {
  document_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface Department extends LookupRecord {
  manager_profile_id?: ID | null;
}

export interface CostCenter extends LookupRecord {
  code?: string | null;
}

export type CostCalculationType =
  | "fixed_monthly"
  | "daily_value"
  | "hourly_value"
  | "percentage_base_salary"
  | "percentage_total_compensation"
  | "percentage_component"
  | "manual_monthly"
  | "formula";

export type CostAppliesTo =
  | "all_employees"
  | "employment_type"
  | "department"
  | "position"
  | "specific_employee"
  | "manual";

export type MonthlyCostEventSource =
  | "manual"
  | "occurrence"
  | "import"
  | "automatic_calculation"
  | "financial_adjustment";

export type MonthlyCostEventStatus = "pending" | "included" | "ignored" | "cancelled";

export type MonthlyEmployeeCostStatus =
  | "estimated"
  | "reviewing"
  | "closed"
  | "reopened"
  | "cancelled";

export interface CostComponentCategory extends Auditable, Activatable {
  id: ID;
  name: string;
  key: string;
  description?: string | null;
  sort_order?: number;
}

export interface CostComponent extends Auditable, Activatable {
  id: ID;
  category_id: ID;
  name: string;
  key: string;
  description?: string | null;
  calculation_type: CostCalculationType;
  default_value?: number | null;
  default_percentage?: number | null;
  applies_to: CostAppliesTo;
  employment_type_id?: ID | null;
  department_id?: ID | null;
  position_id?: ID | null;
  adds_to_company_cost: boolean;
  deducts_from_cost: boolean;
  is_benefit: boolean;
  is_employer_charge: boolean;
  is_provision: boolean;
  is_variable_event: boolean;
  include_in_dashboard: boolean;
  include_in_hour_cost: boolean;
  show_on_employee_profile: boolean;
  sort_order?: number;
  category?: CostComponentCategory | null;
}

export interface Position extends LookupRecord {
  department_id?: ID | null;
}

export type EmploymentType = LookupRecord;
export type MaritalStatus = LookupRecord;

export interface DependentRelationshipType extends LookupRecord {
  is_child: boolean;
  is_spouse: boolean;
  is_parent: boolean;
}

export interface EmployeeStatus extends LookupRecord {
  color: "green" | "orange" | "blue" | "red" | "neutral" | string;
  is_terminal: boolean;
}

export type TerminationReason = LookupRecord;

export interface Employee extends Auditable, Activatable {
  id: ID;
  profile_id?: ID | null;
  full_name: string;
  cpf: string;
  rg?: string | null;
  birth_date?: ISODate | null;
  nationality?: string | null;
  marital_status?: string | null;
  marital_status_id?: ID | null;
  phone?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  employee_number: string;
  hire_date: ISODate;
  termination_date?: ISODate | null;
  termination_reason_id?: ID | null;
  employment_type_id?: ID | null;
  department_id?: ID | null;
  position_id?: ID | null;
  manager_employee_id?: ID | null;
  status_id?: ID | null;
  company_unit_id?: ID | null;
  cost_center_id?: ID | null;
  work_schedule?: string | null;
  internal_notes?: string | null;
  custom_values?: Record<string, JsonValue>;
  deleted_at?: Timestamp | null;
  address?: EmployeeAddress | null;
  department?: Department | null;
  position?: Position | null;
  employment_type?: EmploymentType | null;
  marital_status_record?: MaritalStatus | null;
  status?: EmployeeStatus | null;
  company_unit?: CompanyUnit | null;
  cost_center?: CostCenter | null;
  manager?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
}

export interface EmployeeAddress extends Auditable {
  id: ID;
  employee_id: ID;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
}

export type EmployeeMovementType = "admission" | "termination";
export type EmployeeMovementStatus = "planned" | "completed" | "cancelled";
export type EmployeeMovementCostCategoryScope = EmployeeMovementType | "both";

export interface EmployeeMovementCostCategory extends LookupRecord {
  movement_type: EmployeeMovementCostCategoryScope;
}

export interface EmployeeMovementCostItem extends Auditable, Activatable {
  id: ID;
  movement_id: ID;
  description: string;
  cost_category: string;
  amount: number;
  is_deduction: boolean;
  notes?: string | null;
  sort_order: number;
  deleted_at?: Timestamp | null;
}

export interface EmployeeMovement extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  movement_type: EmployeeMovementType;
  movement_date: ISODate;
  reference_month: ISODate;
  termination_reason_id?: ID | null;
  status: EmployeeMovementStatus;
  notes?: string | null;
  total_amount: number;
  custom_values: Record<string, JsonValue>;
  deleted_at?: Timestamp | null;
  employee?: (Pick<
    Employee,
    "id" | "full_name" | "employee_number" | "department_id" | "position_id" | "status_id"
  > & {
    department?: Department | null;
    position?: Position | null;
    status?: EmployeeStatus | null;
  }) | null;
  termination_reason?: TerminationReason | null;
  cost_items?: EmployeeMovementCostItem[];
}

export interface EmployeeDependent extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  relationship_type_id?: ID | null;
  full_name: string;
  relationship?: string | null;
  birth_date?: ISODate | null;
  document_number?: string | null;
  consider_for_commemorative_dates: boolean;
  consider_as_internal_dependent: boolean;
  notes?: string | null;
  deleted_at?: Timestamp | null;
  relationship_type?: DependentRelationshipType | null;
}

export interface EmployeeCompensation extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  base_salary: number;
  monthly_hours: number;
  hourly_base_rate: number;
  employment_type_id?: ID | null;
  effective_from: ISODate;
  effective_until?: ISODate | null;
  notes?: string | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number" | "employment_type_id"> | null;
  employment_type?: EmploymentType | null;
}

export interface EmployeeCostComponent extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  cost_component_id: ID;
  calculation_type?: CostCalculationType | null;
  value?: number | null;
  percentage?: number | null;
  quantity?: number | null;
  effective_from: ISODate;
  effective_until?: ISODate | null;
  notes?: string | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
  cost_component?: CostComponent | null;
}

export interface EmployeeMonthlyCostEvent extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  reference_month: ISODate;
  cost_component_id: ID;
  description: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  source: MonthlyCostEventSource;
  status: MonthlyCostEventStatus;
  notes?: string | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
  cost_component?: CostComponent | null;
}

export interface MonthlyEmployeeCost extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  reference_month: ISODate;
  base_salary: number;
  fixed_compensation_total: number;
  benefits_total: number;
  allowances_total: number;
  employer_charges_total: number;
  provisions_total: number;
  variable_events_total: number;
  reimbursements_total: number;
  deductions_total: number;
  total_company_cost: number;
  contracted_hours?: number | null;
  worked_hours?: number | null;
  productive_hours?: number | null;
  contractual_hour_cost?: number | null;
  worked_hour_cost?: number | null;
  productive_hour_cost?: number | null;
  status: MonthlyEmployeeCostStatus;
  calculated_at: Timestamp;
  closed_at?: Timestamp | null;
  closed_by?: ID | null;
  notes?: string | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number" | "department_id" | "department"> | null;
}

export interface MonthlyEmployeeCostItem {
  id: ID;
  monthly_employee_cost_id: ID;
  employee_id: ID;
  cost_component_id?: ID | null;
  component_name_snapshot: string;
  category_name_snapshot?: string | null;
  calculation_type_snapshot?: CostCalculationType | null;
  quantity?: number | null;
  unit_value?: number | null;
  percentage?: number | null;
  total_value: number;
  created_at: Timestamp;
}

export interface OccurrenceCostRule extends Auditable, Activatable {
  id: ID;
  occurrence_type_id: ID;
  reduces_worked_hours: boolean;
  generates_discount: boolean;
  impacts_attendance_bonus: boolean;
  default_hours_impact?: number | null;
  default_cost_component_id?: ID | null;
  occurrence_type?: OccurrenceType | null;
  default_cost_component?: CostComponent | null;
}

export interface EmployeeUpsertInput {
  employee: Omit<
    Partial<Employee>,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_by"
    | "updated_by"
    | "address"
    | "department"
    | "position"
    | "employment_type"
    | "marital_status_record"
    | "status"
    | "company_unit"
    | "cost_center"
    | "manager"
  > & {
    full_name: string;
    cpf: string;
    employee_number: string;
    hire_date: ISODate;
  };
  address?: Partial<EmployeeAddress>;
}

export interface DocumentType extends LookupRecord {
  requires_expiration_date: boolean;
  default_validity_months?: number | null;
  allowed_mime_types: string[];
  max_file_size_mb: number;
}

export type EmployeeDocumentStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired"
  | "expires_soon";

export interface EmployeeDocument extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  document_type_id: ID;
  storage_bucket: string;
  storage_path?: string | null;
  original_file_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  issue_date?: ISODate | null;
  expiration_date?: ISODate | null;
  status: EmployeeDocumentStatus;
  notes?: string | null;
  submitted_by?: ID | null;
  submitted_at?: Timestamp | null;
  approved_by?: ID | null;
  approved_at?: Timestamp | null;
  rejected_by?: ID | null;
  rejected_at?: Timestamp | null;
  rejection_reason?: string | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
  document_type?: DocumentType | null;
}

export interface RequiredDocument extends Auditable, Activatable {
  id: ID;
  document_type_id: ID;
  employment_type_id?: ID | null;
  department_id?: ID | null;
  position_id?: ID | null;
  is_required: boolean;
}

export type WorkflowStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "in_progress"
  | "finished"
  | "cancelled";

export interface Vacation extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  accrual_period_start: ISODate;
  accrual_period_end: ISODate;
  vacation_start: ISODate;
  vacation_end: ISODate;
  days_count: number;
  status: WorkflowStatus;
  notes?: string | null;
  approved_by?: ID | null;
  approved_at?: Timestamp | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
}

export interface LeaveType extends LookupRecord {
  requires_document: boolean;
}

export interface EmployeeLeave extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  leave_type_id: ID;
  start_date: ISODate;
  end_date?: ISODate | null;
  document_id?: ID | null;
  status: WorkflowStatus;
  notes?: string | null;
  approved_by?: ID | null;
  approved_at?: Timestamp | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
  leave_type?: LeaveType | null;
}

export interface Training extends LookupRecord {
  validity_months?: number | null;
  is_required: boolean;
}

export type EmployeeTrainingStatus =
  | "scheduled"
  | "completed"
  | "expired"
  | "expires_soon"
  | "cancelled";

export interface EmployeeTraining extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  training_id: ID;
  completion_date: ISODate;
  expiration_date?: ISODate | null;
  certificate_document_id?: ID | null;
  status: EmployeeTrainingStatus;
  notes?: string | null;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number"> | null;
  training?: Training | null;
}

export type OccurrenceCategory = LookupRecord;

export interface OccurrenceType extends LookupRecord {
  occurrence_category_id?: ID | null;
  /** @deprecated Occurrences no longer accept attachments; kept only for database compatibility. */
  requires_attachment: boolean;
  requires_approval: boolean;
  visible_to_employee: boolean;
  visible_to_manager: boolean;
  generates_alert: boolean;
  impacts_history: boolean;
  include_in_daily_report: boolean;
  counts_as_absence: boolean;
  counts_as_medical_certificate: boolean;
  is_punishment?: boolean;
  punishment_level?: string | null;
  priority_order: number;
  occurrence_category?: OccurrenceCategory | null;
}

export type OccurrenceStatus =
  | "open"
  | "in_review"
  | "approved"
  | "rejected"
  | "closed"
  | "cancelled";

export type OccurrenceVisibility =
  | "restricted"
  | "manager"
  | "employee"
  | "public_internal";

export interface EmployeeOccurrence extends Auditable, Activatable {
  id: ID;
  employee_id: ID;
  occurrence_type_id: ID;
  occurrence_category_id?: ID | null;
  department_id?: ID | null;
  title: string;
  description: string;
  occurred_at: Timestamp;
  start_date?: ISODate | null;
  end_date?: ISODate | null;
  total_days?: number | null;
  justification_summary?: string | null;
  internal_notes?: string | null;
  registered_by?: ID | null;
  status: OccurrenceStatus;
  visibility: OccurrenceVisibility;
  notes?: string | null;
  custom_values?: Record<string, JsonValue>;
  deleted_at?: Timestamp | null;
  employee?: Pick<Employee, "id" | "full_name" | "employee_number" | "department_id" | "department"> | null;
  department?: Department | null;
  occurrence_type?: OccurrenceType | null;
  occurrence_category?: OccurrenceCategory | null;
}

export interface DailyOccurrenceReport {
  id: ID;
  report_date: ISODate;
  generated_text: string;
  edited_text?: string | null;
  generated_by?: ID | null;
  copied_at?: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DailyOccurrenceReportItem {
  id: ID;
  report_id: ID;
  employee_id?: ID | null;
  department_id?: ID | null;
  occurrence_id?: ID | null;
  occurrence_type_id?: ID | null;
  display_text: string;
  sort_order: number;
  created_at: Timestamp;
}

export interface DailyOccurrenceReportWithAuthor extends DailyOccurrenceReport {
  generated_by_profile?: Pick<Profile, "auth_user_id" | "full_name" | "email"> | null;
  items?: DailyOccurrenceReportItem[];
}

export interface Role extends Activatable {
  id: ID;
  name: string;
  key: string;
  description?: string | null;
  is_system: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Permission extends Activatable {
  id: ID;
  module: string;
  action: string;
  key: string;
  description?: string | null;
  is_sensitive: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type PermissionScope =
  | "all"
  | "own_department"
  | "subordinates"
  | "own_data"
  | "none";

export interface RolePermission {
  id: ID;
  role_id: ID;
  permission_id: ID;
  scope: PermissionScope;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserRole extends Activatable {
  id: ID;
  profile_id: ID;
  role_id: ID;
  assigned_at: Timestamp;
  assigned_by?: ID | null;
  expires_at?: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type CustomFieldEntity = "employee" | "document" | "occurrence" | "training";
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi_select"
  | "file";

export interface CustomField extends Auditable, Activatable {
  id: ID;
  entity: CustomFieldEntity;
  label: string;
  key: string;
  field_type: CustomFieldType;
  placeholder?: string | null;
  help_text?: string | null;
  is_required: boolean;
  visibility_rules: Record<string, JsonValue>;
  validation_rules: Record<string, JsonValue>;
  sort_order: number;
  options?: CustomFieldOption[];
}

export interface CustomFieldOption extends Activatable {
  id: ID;
  custom_field_id: ID;
  label: string;
  value: string;
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CustomFieldValue extends Auditable {
  id: ID;
  custom_field_id: ID;
  entity: CustomFieldEntity;
  entity_id: ID;
  value?: JsonValue;
}

export interface AlertRule extends Auditable, Activatable {
  id: ID;
  name: string;
  key: string;
  entity: string;
  event: string;
  days_before?: number | null;
  severity: "info" | "warning" | "critical";
  channels: string[];
  config: Record<string, JsonValue>;
}

export interface AuditLog {
  id: ID;
  actor_profile_id?: ID | null;
  actor_auth_user_id?: ID | null;
  action: string;
  entity: string;
  entity_id?: ID | null;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata: Record<string, JsonValue>;
  created_at: Timestamp;
}

export interface EmployeeHistoryEvent {
  id: ID;
  employee_id: ID;
  event_type: string;
  title: string;
  description?: string | null;
  event_date: Timestamp;
  source_entity?: string | null;
  source_entity_id?: ID | null;
  metadata: Record<string, JsonValue>;
  created_at: Timestamp;
  created_by?: ID | null;
}
