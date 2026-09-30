begin;

insert into public.occurrence_categories (
  name,
  key,
  description,
  sort_order,
  is_active
)
values (
  'Ausências',
  'ausencias',
  'Faltas, ausências parciais e registros médicos.',
  8,
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

insert into public.occurrence_types (
  name,
  key,
  occurrence_category_id,
  description,
  requires_attachment,
  requires_approval,
  visible_to_employee,
  visible_to_manager,
  generates_alert,
  impacts_history,
  include_in_daily_report,
  counts_as_absence,
  counts_as_medical_certificate,
  is_punishment,
  punishment_level,
  priority_order,
  sort_order,
  is_active
)
select
  'Falta sem justificativa',
  'falta_sem_justificativa',
  (select id from public.occurrence_categories where key = 'ausencias'),
  'Falta sem justificativa registrada.',
  false,
  false,
  false,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  null,
  4,
  83,
  true
where not exists (
  select 1
  from public.occurrence_types
  where key = 'falta_sem_justificativa'
);

update public.occurrence_types
set
  name = 'Falta sem justificativa',
  occurrence_category_id = (select id from public.occurrence_categories where key = 'ausencias'),
  description = 'Falta sem justificativa registrada.',
  include_in_daily_report = true,
  counts_as_absence = true,
  counts_as_medical_certificate = false,
  is_punishment = false,
  punishment_level = null,
  priority_order = 4,
  sort_order = 83,
  is_active = true,
  updated_at = now()
where key = 'falta_sem_justificativa';

with occurrence_type_ids as (
  select
    (select id from public.occurrence_types where key = 'falta') as old_type_id,
    (select id from public.occurrence_types where key = 'falta_sem_justificativa') as target_type_id,
    (select id from public.occurrence_categories where key = 'ausencias') as target_category_id
)
update public.employee_occurrences
set
  occurrence_type_id = occurrence_type_ids.target_type_id,
  occurrence_category_id = occurrence_type_ids.target_category_id,
  title = case
    when lower(btrim(public.employee_occurrences.title)) = 'falta'
      then 'Falta sem justificativa'
    else public.employee_occurrences.title
  end,
  description = case
    when lower(btrim(public.employee_occurrences.description)) = 'falta'
      then 'Falta sem justificativa'
    else public.employee_occurrences.description
  end,
  updated_at = now()
from occurrence_type_ids
where occurrence_type_ids.old_type_id is not null
  and occurrence_type_ids.target_type_id is not null
  and public.employee_occurrences.occurrence_type_id = occurrence_type_ids.old_type_id;

update public.employee_occurrences
set
  title = case
    when lower(btrim(title)) = 'falta'
      then 'Falta sem justificativa'
    else title
  end,
  description = case
    when lower(btrim(description)) = 'falta'
      then 'Falta sem justificativa'
    else description
  end,
  updated_at = now()
where lower(btrim(title)) = 'falta'
   or lower(btrim(description)) = 'falta';

with occurrence_type_ids as (
  select
    (select id from public.occurrence_types where key = 'falta') as old_type_id,
    (select id from public.occurrence_types where key = 'falta_sem_justificativa') as target_type_id
),
old_rule as (
  select occurrence_cost_rules.*
  from public.occurrence_cost_rules
  join occurrence_type_ids on occurrence_type_ids.old_type_id = occurrence_cost_rules.occurrence_type_id
),
merged_rule as (
  select
    occurrence_type_ids.target_type_id as occurrence_type_id,
    coalesce(old_rule.reduces_worked_hours, true) as reduces_worked_hours,
    coalesce(old_rule.generates_discount, true) as generates_discount,
    coalesce(old_rule.impacts_attendance_bonus, true) as impacts_attendance_bonus,
    old_rule.default_hours_impact,
    coalesce(
      old_rule.default_cost_component_id,
      (select id from public.cost_components where key = 'falta_descontada')
    ) as default_cost_component_id,
    coalesce(old_rule.is_active, true) as is_active
  from occurrence_type_ids
  left join old_rule on true
  where occurrence_type_ids.target_type_id is not null
)
insert into public.occurrence_cost_rules (
  occurrence_type_id,
  reduces_worked_hours,
  generates_discount,
  impacts_attendance_bonus,
  default_hours_impact,
  default_cost_component_id,
  is_active
)
select
  occurrence_type_id,
  reduces_worked_hours,
  generates_discount,
  impacts_attendance_bonus,
  default_hours_impact,
  default_cost_component_id,
  is_active
from merged_rule
on conflict (occurrence_type_id) do update
set
  reduces_worked_hours = coalesce(public.occurrence_cost_rules.reduces_worked_hours, false)
    or coalesce(excluded.reduces_worked_hours, false),
  generates_discount = coalesce(public.occurrence_cost_rules.generates_discount, false)
    or coalesce(excluded.generates_discount, false),
  impacts_attendance_bonus = coalesce(public.occurrence_cost_rules.impacts_attendance_bonus, false)
    or coalesce(excluded.impacts_attendance_bonus, false),
  default_hours_impact = coalesce(public.occurrence_cost_rules.default_hours_impact, excluded.default_hours_impact),
  default_cost_component_id = coalesce(public.occurrence_cost_rules.default_cost_component_id, excluded.default_cost_component_id),
  is_active = coalesce(public.occurrence_cost_rules.is_active, false)
    or coalesce(excluded.is_active, false),
  updated_at = now();

with occurrence_type_ids as (
  select (select id from public.occurrence_types where key = 'falta') as old_type_id
)
update public.occurrence_cost_rules
set
  is_active = false,
  updated_at = now()
from occurrence_type_ids
where occurrence_type_ids.old_type_id is not null
  and public.occurrence_cost_rules.occurrence_type_id = occurrence_type_ids.old_type_id;

update public.occurrence_types
set
  name = 'Falta sem justificativa (substituída)',
  description = 'Tipo substituído por Falta sem justificativa. Mantido inativo apenas para histórico técnico.',
  include_in_daily_report = false,
  counts_as_absence = false,
  counts_as_medical_certificate = false,
  is_punishment = false,
  punishment_level = null,
  priority_order = 999,
  sort_order = 999,
  is_active = false,
  updated_at = now()
where key = 'falta';

commit;
