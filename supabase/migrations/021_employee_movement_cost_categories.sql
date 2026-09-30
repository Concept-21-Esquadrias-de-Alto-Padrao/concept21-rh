begin;

create table if not exists public.employee_movement_cost_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  movement_type text not null default 'both',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint employee_movement_cost_categories_type_check check (
    movement_type in ('admission', 'termination', 'both')
  )
);

create index if not exists employee_movement_cost_categories_type_idx
on public.employee_movement_cost_categories(movement_type, sort_order, name);

drop trigger if exists set_employee_movement_cost_categories_updated_at
on public.employee_movement_cost_categories;

create trigger set_employee_movement_cost_categories_updated_at
before update on public.employee_movement_cost_categories
for each row execute function app.set_updated_at();

alter table public.employee_movement_cost_categories enable row level security;

drop policy if exists "employee_movement_cost_categories_select"
on public.employee_movement_cost_categories;
create policy "employee_movement_cost_categories_select"
on public.employee_movement_cost_categories for select to authenticated
using (
  app.has_permission('hr.movements.view')
  or app.has_permission('hr.movements.manage')
  or app.has_permission('hr.settings.view')
);

drop policy if exists "employee_movement_cost_categories_insert"
on public.employee_movement_cost_categories;
create policy "employee_movement_cost_categories_insert"
on public.employee_movement_cost_categories for insert to authenticated
with check (
  app.has_permission('hr.movements.manage')
  or app.has_permission('hr.settings.manage')
);

drop policy if exists "employee_movement_cost_categories_update"
on public.employee_movement_cost_categories;
create policy "employee_movement_cost_categories_update"
on public.employee_movement_cost_categories for update to authenticated
using (
  app.has_permission('hr.movements.manage')
  or app.has_permission('hr.settings.manage')
)
with check (
  app.has_permission('hr.movements.manage')
  or app.has_permission('hr.settings.manage')
);

drop policy if exists "employee_movement_cost_categories_master_delete"
on public.employee_movement_cost_categories;
create policy "employee_movement_cost_categories_master_delete"
on public.employee_movement_cost_categories for delete to authenticated
using (app.has_role('master'));

insert into public.employee_movement_cost_categories (name, key, description, movement_type, sort_order)
values
  ('Exame admissional', 'admission_exam', 'Custos de exame admissional.', 'admission', 10),
  ('Documentação', 'admission_documents', 'Custos de documentação admissional.', 'admission', 20),
  ('Integração / treinamento', 'admission_training', 'Custos iniciais de integração ou treinamento.', 'admission', 30),
  ('EPI / uniforme', 'admission_equipment', 'Custos de EPI, uniforme ou equipamento na admissão.', 'admission', 40),
  ('Ajuda / bônus', 'admission_bonus', 'Ajuda, bônus ou verba inicial de admissão.', 'admission', 50),
  ('Saldo de salário', 'termination_salary_balance', 'Saldo de salário no desligamento.', 'termination', 10),
  ('Aviso prévio', 'termination_notice', 'Custos relacionados ao aviso prévio.', 'termination', 20),
  ('Férias rescisórias', 'termination_vacation', 'Férias vencidas, proporcionais e adicionais rescisórios.', 'termination', 30),
  ('13º salário', 'termination_13th', '13º salário rescisório.', 'termination', 40),
  ('FGTS / multa', 'termination_fgts', 'FGTS, multa e guias relacionadas ao desligamento.', 'termination', 50),
  ('Guias / taxas', 'termination_tax', 'Guias, taxas e encargos acessórios de desligamento.', 'termination', 60),
  ('Desconto / abatimento', 'discount', 'Desconto ou abatimento aplicado ao custo do movimento.', 'termination', 70),
  ('Outros', 'other', 'Outros custos de admissão ou desligamento.', 'both', 999)
on conflict (key) do nothing;

commit;
