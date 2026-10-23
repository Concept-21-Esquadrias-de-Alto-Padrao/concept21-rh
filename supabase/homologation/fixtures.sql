-- Executado exclusivamente pelo bootstrap com destino de homologacao fixo.
insert into public.positions (name, key) values ('TESTE - Assistente', 'homologacao_assistente') on conflict (key) do nothing;

insert into public.employees (full_name, cpf, employee_number, hire_date, department_id, position_id, employment_type_id, status_id, internal_notes)
select v.name, v.cpf, v.number, date '2025-01-06', d.id, p.id, t.id, s.id, 'Dado inteiramente ficticio para homologacao. Nao usar em pagamentos.'
from (values
  ('TESTE RH - Ana Exemplo', '00000000191', 'HOM-001', 'rh'),
  ('TESTE RH - Bruno Exemplo', '00000000272', 'HOM-002', 'producao'),
  ('TESTE RH - Carla Exemplo', '00000000353', 'HOM-003', 'producao'),
  ('TESTE RH - Daniel Exemplo', '00000000434', 'HOM-004', 'obras'),
  ('TESTE RH - Elisa Exemplo', '00000000515', 'HOM-005', 'obras'),
  ('TESTE RH - Fabio Exemplo', '00000000604', 'HOM-006', 'rh')
) v(name, cpf, number, department)
join public.departments d on d.key = v.department
cross join public.positions p
cross join public.employment_types t
cross join public.employee_statuses s
where p.key = 'homologacao_assistente' and t.key = 'clt' and s.key = 'ativo'
on conflict (employee_number) do nothing;

insert into public.employee_compensations (employee_id, base_salary, monthly_hours, hourly_base_rate, effective_from, notes)
select e.id, 3000, 220, 3000.0/220, e.hire_date, 'Salario ficticio de teste.' from public.employees e where e.employee_number like 'HOM-%'
on conflict (employee_id, effective_from) do nothing;

insert into public.employee_movements (employee_id, movement_type, movement_date, reference_month, status, notes)
select e.id, 'admission', e.hire_date, date_trunc('month', e.hire_date)::date, 'completed', 'Admissao ficticia para testes.'
from public.employees e where e.employee_number like 'HOM-%';

insert into public.employee_occurrences (employee_id, occurrence_type_id, occurrence_category_id, title, description, occurred_at, start_date, end_date, total_days, visibility)
select e.id, t.id, t.occurrence_category_id, 'TESTE RH - ' || t.name, 'Registro ficticio para validar filtros e relatorios.',
  date_trunc('month', current_date) + interval '5 days 8 hours 7 minutes',
  (date_trunc('month', current_date) + interval '5 days')::date,
  (date_trunc('month', current_date) + interval '5 days')::date, 1, 'restricted'
from public.employees e cross join public.occurrence_types t
where e.employee_number in ('HOM-001', 'HOM-002') and t.key in ('falta_sem_justificativa', 'advertencia_escrita');

insert into public.vacations (employee_id, accrual_period_start, accrual_period_end, vacation_start, vacation_end, days_count, status, notes)
select id, date '2025-01-06', date '2026-01-05', current_date + 10, current_date + 19, 10, 'requested', 'Ferias ficticias de teste; controle atual, sem compensacao automatica.'
from public.employees where employee_number = 'HOM-004';

insert into public.employee_trainings (employee_id, training_id, completion_date, expiration_date, notes)
select e.id, t.id, current_date - 30, current_date + 15, 'Certificacao ficticia de teste.'
from public.employees e cross join public.trainings t where e.employee_number = 'HOM-002' and t.key = 'nr_35';

insert into public.employee_documents (employee_id, document_type_id, status, expiration_date, notes)
select e.id, t.id, 'pending', current_date + 15, 'Documento ficticio, ainda sem arquivo.'
from public.employees e cross join public.document_types t where e.employee_number = 'HOM-003' and t.key = 'aso_admissional';
