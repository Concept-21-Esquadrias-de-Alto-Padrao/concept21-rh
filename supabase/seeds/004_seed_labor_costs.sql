begin;

insert into public.cost_component_categories (name, key, description, sort_order)
values
  ('Remuneração fixa', 'remuneracao_fixa', 'Valores fixos de salário e remuneração contratual.', 1),
  ('Benefício', 'beneficio', 'Benefícios recorrentes oferecidos ao colaborador.', 2),
  ('Ajuda de custo', 'ajuda_de_custo', 'Ajudas e subsídios operacionais.', 3),
  ('Encargo', 'encargo', 'Encargos patronais configuráveis.', 4),
  ('Provisão', 'provisao', 'Provisões gerenciais para férias, 13º e reflexos.', 5),
  ('Evento variável', 'evento_variavel', 'Eventos variáveis lançados por competência.', 6),
  ('Desconto', 'desconto', 'Valores que reduzem o custo gerencial do mês.', 7),
  ('Reembolso', 'reembolso', 'Reembolsos e ressarcimentos.', 8),
  ('Outro', 'outro', 'Componentes não classificados nas categorias principais.', 99)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

with component_seed as (
  select *
  from (
    values
      ('Salário-base', 'salario_base', 'remuneracao_fixa', 'Base contratual registrada na remuneração do colaborador.', 'manual_monthly', null::numeric, null::numeric, 'manual', true, false, false, false, false, false, true, true, true, 1),
      ('FGTS', 'fgts', 'encargo', 'Valor mensal informado para custo real do colaborador.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, true, false, false, true, true, true, 10),
      ('INSS patronal', 'inss_patronal', 'encargo', 'Valor mensal informado para encargos patronais.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, true, false, false, true, true, true, 11),
      ('RAT', 'rat', 'encargo', 'Valor mensal informado para risco ambiental do trabalho.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, true, false, false, true, true, true, 12),
      ('FAP', 'fap', 'encargo', 'Valor mensal informado para fator acidentario de prevencao.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, true, false, false, true, true, true, 13),
      ('Terceiros / Sistema S', 'terceiros_sistema_s', 'encargo', 'Valor mensal informado para terceiros e Sistema S.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, true, false, false, true, true, true, 14),
      ('Provisão 13º salário', 'provisao_13_salario', 'provisao', 'Valor mensal informado para provisao de 13 salario.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, true, false, true, true, true, 20),
      ('Provisão férias', 'provisao_ferias', 'provisao', 'Valor mensal informado para provisao de ferias.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, true, false, true, true, true, 21),
      ('Provisão 1/3 de férias', 'provisao_um_terco_ferias', 'provisao', 'Valor mensal informado para um terco de ferias.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, true, false, true, true, true, 22),
      ('FGTS sobre provisões', 'fgts_sobre_provisoes', 'provisao', 'Valor mensal informado para reflexos sobre provisoes.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, true, false, true, true, true, 23),
      ('Provisão multa rescisória FGTS', 'provisao_multa_rescisoria_fgts', 'provisao', 'Valor mensal informado para provisao de multa rescisoria FGTS.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, true, false, true, true, true, 24),
      ('Vale-transporte', 'vale_transporte', 'beneficio', 'Benefício configurável por colaborador ou evento mensal.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 30),
      ('Vale-alimentação', 'vale_alimentacao', 'beneficio', 'Valor diário inicial editável.', 'daily_value', 25.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 31),
      ('Vale-refeição', 'vale_refeicao', 'beneficio', 'Valor diário editável.', 'daily_value', 0.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 32),
      ('Cesta básica', 'cesta_basica', 'beneficio', 'Valor mensal editável.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 33),
      ('Plano de saúde', 'plano_saude', 'beneficio', 'Valor mensal editável.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 34),
      ('Plano odontológico', 'plano_odontologico', 'beneficio', 'Valor mensal editável.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, true, false, false, false, true, true, true, 35),
      ('Ajuda de custo', 'ajuda_de_custo', 'ajuda_de_custo', 'Ajuda mensal configurável.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, false, true, true, true, 40),
      ('Ajuda combustível', 'ajuda_combustivel', 'ajuda_de_custo', 'Ajuda de combustível mensal ou eventual.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, false, true, true, true, 41),
      ('Prêmio de assiduidade', 'premio_assiduidade', 'evento_variavel', 'Prêmio configurável por colaborador ou fechamento mensal.', 'fixed_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 50),
      ('Hora extra', 'hora_extra', 'evento_variavel', 'Evento variável lançado por competência.', 'hourly_value', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 51),
      ('Comissão', 'comissao', 'evento_variavel', 'Evento variável informado no mês.', 'manual_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 52),
      ('Bônus', 'bonus', 'evento_variavel', 'Evento variável informado no mês.', 'manual_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 53),
      ('Falta descontada', 'falta_descontada', 'desconto', 'Desconto manual ou derivado de ocorrência.', 'hourly_value', 0.00::numeric, null::numeric, 'manual', false, true, false, false, false, true, true, true, true, 60),
      ('Atraso descontado', 'atraso_descontado', 'desconto', 'Desconto manual ou derivado de atraso.', 'hourly_value', 0.00::numeric, null::numeric, 'manual', false, true, false, false, false, true, true, true, true, 61),
      ('Reembolso', 'reembolso', 'reembolso', 'Reembolso lançado na competência.', 'manual_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 70),
      ('Outro', 'outro', 'outro', 'Componente genérico editável.', 'manual_monthly', 0.00::numeric, null::numeric, 'manual', true, false, false, false, false, true, true, true, true, 99)
  ) as seed(
    name,
    key,
    category_key,
    description,
    calculation_type,
    default_value,
    default_percentage,
    applies_to,
    adds_to_company_cost,
    deducts_from_cost,
    is_benefit,
    is_employer_charge,
    is_provision,
    is_variable_event,
    include_in_dashboard,
    include_in_hour_cost,
    show_on_employee_profile,
    sort_order
  )
)
insert into public.cost_components (
  name,
  key,
  category_id,
  description,
  calculation_type,
  default_value,
  default_percentage,
  applies_to,
  adds_to_company_cost,
  deducts_from_cost,
  is_benefit,
  is_employer_charge,
  is_provision,
  is_variable_event,
  include_in_dashboard,
  include_in_hour_cost,
  show_on_employee_profile,
  sort_order
)
select
  seed.name,
  seed.key,
  category.id,
  seed.description,
  seed.calculation_type,
  seed.default_value,
  seed.default_percentage,
  seed.applies_to,
  seed.adds_to_company_cost,
  seed.deducts_from_cost,
  seed.is_benefit,
  seed.is_employer_charge,
  seed.is_provision,
  seed.is_variable_event,
  seed.include_in_dashboard,
  seed.include_in_hour_cost,
  seed.show_on_employee_profile,
  seed.sort_order
from component_seed seed
join public.cost_component_categories category on category.key = seed.category_key
on conflict (key) do update
set
  name = excluded.name,
  category_id = excluded.category_id,
  description = excluded.description,
  calculation_type = excluded.calculation_type,
  default_value = excluded.default_value,
  default_percentage = excluded.default_percentage,
  applies_to = excluded.applies_to,
  adds_to_company_cost = excluded.adds_to_company_cost,
  deducts_from_cost = excluded.deducts_from_cost,
  is_benefit = excluded.is_benefit,
  is_employer_charge = excluded.is_employer_charge,
  is_provision = excluded.is_provision,
  is_variable_event = excluded.is_variable_event,
  include_in_dashboard = excluded.include_in_dashboard,
  include_in_hour_cost = excluded.include_in_hour_cost,
  show_on_employee_profile = excluded.show_on_employee_profile,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.occurrence_cost_rules (
  occurrence_type_id,
  reduces_worked_hours,
  generates_discount,
  impacts_attendance_bonus,
  default_hours_impact,
  default_cost_component_id
)
select
  occurrence_types.id,
  true,
  occurrence_types.key in ('falta_sem_justificativa', 'atraso'),
  occurrence_types.key in ('falta_sem_justificativa', 'atraso'),
  case occurrence_types.key when 'atraso' then 1 else null end,
  case
    when occurrence_types.key = 'falta_sem_justificativa' then (select id from public.cost_components where key = 'falta_descontada')
    when occurrence_types.key = 'atraso' then (select id from public.cost_components where key = 'atraso_descontado')
    else null
  end
from public.occurrence_types
where occurrence_types.key in ('falta_sem_justificativa', 'atraso')
on conflict (occurrence_type_id) do update
set
  reduces_worked_hours = excluded.reduces_worked_hours,
  generates_discount = excluded.generates_discount,
  impacts_attendance_bonus = excluded.impacts_attendance_bonus,
  default_hours_impact = excluded.default_hours_impact,
  default_cost_component_id = excluded.default_cost_component_id,
  is_active = true;

commit;
