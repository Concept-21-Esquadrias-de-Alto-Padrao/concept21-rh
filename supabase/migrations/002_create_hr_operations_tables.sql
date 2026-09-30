create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  requires_expiration_date boolean not null default false,
  default_validity_months integer,
  allowed_mime_types text[] not null default array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  max_file_size_mb integer not null default 15,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint document_types_validity_positive check (
    default_validity_months is null or default_validity_months > 0
  )
);

create table if not exists public.required_documents (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references public.document_types(id),
  employment_type_id uuid references public.employment_types(id),
  department_id uuid references public.departments(id),
  position_id uuid references public.positions(id),
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint required_documents_unique_rule unique (
    document_type_id,
    employment_type_id,
    department_id,
    position_id
  )
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id),
  storage_bucket text not null default 'hr-documents',
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint,
  issue_date date,
  expiration_date date,
  status text not null default 'pending',
  notes text,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_documents_status_check check (
    status in ('pending', 'submitted', 'approved', 'rejected', 'expired', 'expires_soon')
  ),
  constraint employee_documents_expiration_after_issue check (
    expiration_date is null or issue_date is null or expiration_date >= issue_date
  )
);

create table if not exists public.vacations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  accrual_period_start date not null,
  accrual_period_end date not null,
  vacation_start date not null,
  vacation_end date not null,
  days_count integer not null,
  status text not null default 'requested',
  notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint vacations_status_check check (
    status in ('requested', 'approved', 'rejected', 'in_progress', 'finished', 'cancelled')
  ),
  constraint vacations_accrual_period_check check (accrual_period_end >= accrual_period_start),
  constraint vacations_period_check check (vacation_end >= vacation_start),
  constraint vacations_days_positive check (days_count > 0)
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  requires_document boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.employee_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date,
  document_id uuid references public.employee_documents(id),
  status text not null default 'requested',
  notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_leaves_status_check check (
    status in ('requested', 'approved', 'rejected', 'in_progress', 'finished', 'cancelled')
  ),
  constraint employee_leaves_period_check check (end_date is null or end_date >= start_date)
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  validity_months integer,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint trainings_validity_positive check (validity_months is null or validity_months > 0)
);

create table if not exists public.employee_trainings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  training_id uuid not null references public.trainings(id),
  completion_date date not null,
  expiration_date date,
  certificate_document_id uuid references public.employee_documents(id),
  status text not null default 'completed',
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_trainings_status_check check (
    status in ('scheduled', 'completed', 'expired', 'expires_soon', 'cancelled')
  ),
  constraint employee_trainings_expiration_after_completion check (
    expiration_date is null or expiration_date >= completion_date
  )
);

create table if not exists public.occurrence_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.occurrence_types (
  id uuid primary key default gen_random_uuid(),
  occurrence_category_id uuid references public.occurrence_categories(id),
  name text not null,
  key text not null unique,
  description text,
  requires_attachment boolean not null default false,
  requires_approval boolean not null default false,
  visible_to_employee boolean not null default false,
  visible_to_manager boolean not null default true,
  generates_alert boolean not null default false,
  impacts_history boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.employee_occurrences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  occurrence_type_id uuid not null references public.occurrence_types(id),
  occurrence_category_id uuid references public.occurrence_categories(id),
  title text not null,
  description text not null,
  occurred_at timestamptz not null,
  registered_by uuid references auth.users(id),
  status text not null default 'open',
  visibility text not null default 'restricted',
  notes text,
  custom_values jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_occurrences_status_check check (
    status in ('open', 'in_review', 'approved', 'rejected', 'closed', 'cancelled')
  ),
  constraint employee_occurrences_visibility_check check (
    visibility in ('restricted', 'manager', 'employee', 'public_internal')
  )
);

create table if not exists public.employee_occurrence_attachments (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.employee_occurrences(id) on delete cascade,
  employee_document_id uuid references public.employee_documents(id),
  storage_bucket text not null default 'hr-documents',
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists employee_documents_employee_idx on public.employee_documents(employee_id);
create index if not exists employee_documents_type_idx on public.employee_documents(document_type_id);
create index if not exists employee_documents_status_idx on public.employee_documents(status);
create index if not exists employee_documents_expiration_idx on public.employee_documents(expiration_date);
create index if not exists vacations_employee_idx on public.vacations(employee_id);
create index if not exists vacations_status_idx on public.vacations(status);
create index if not exists employee_leaves_employee_idx on public.employee_leaves(employee_id);
create index if not exists employee_leaves_status_idx on public.employee_leaves(status);
create index if not exists employee_trainings_employee_idx on public.employee_trainings(employee_id);
create index if not exists employee_trainings_training_idx on public.employee_trainings(training_id);
create index if not exists employee_trainings_expiration_idx on public.employee_trainings(expiration_date);
create index if not exists employee_occurrences_employee_idx on public.employee_occurrences(employee_id);
create index if not exists employee_occurrences_type_idx on public.employee_occurrences(occurrence_type_id);
create index if not exists employee_occurrences_status_idx on public.employee_occurrences(status);
create index if not exists employee_occurrences_occurred_at_idx on public.employee_occurrences(occurred_at);

create trigger set_document_types_updated_at
before update on public.document_types
for each row execute function app.set_updated_at();

create trigger set_required_documents_updated_at
before update on public.required_documents
for each row execute function app.set_updated_at();

create trigger set_employee_documents_updated_at
before update on public.employee_documents
for each row execute function app.set_updated_at();

create trigger set_vacations_updated_at
before update on public.vacations
for each row execute function app.set_updated_at();

create trigger set_leave_types_updated_at
before update on public.leave_types
for each row execute function app.set_updated_at();

create trigger set_employee_leaves_updated_at
before update on public.employee_leaves
for each row execute function app.set_updated_at();

create trigger set_trainings_updated_at
before update on public.trainings
for each row execute function app.set_updated_at();

create trigger set_employee_trainings_updated_at
before update on public.employee_trainings
for each row execute function app.set_updated_at();

create trigger set_occurrence_categories_updated_at
before update on public.occurrence_categories
for each row execute function app.set_updated_at();

create trigger set_occurrence_types_updated_at
before update on public.occurrence_types
for each row execute function app.set_updated_at();

create trigger set_employee_occurrences_updated_at
before update on public.employee_occurrences
for each row execute function app.set_updated_at();
