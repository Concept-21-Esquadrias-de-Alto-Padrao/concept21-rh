begin;

update public.cost_components
set
  description = 'Valor mensal informado para provisao de multa rescisoria FGTS.',
  calculation_type = 'fixed_monthly',
  default_value = 0.00,
  default_percentage = null,
  applies_to = 'manual',
  is_provision = true,
  is_employer_charge = false,
  include_in_dashboard = true,
  include_in_hour_cost = true,
  show_on_employee_profile = true,
  is_active = true
where key = 'provisao_multa_rescisoria_fgts';

commit;
