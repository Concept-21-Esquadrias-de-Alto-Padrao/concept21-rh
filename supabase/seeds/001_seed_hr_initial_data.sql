insert into public.company_units (name, key, city, state, sort_order)
values ('Concept21 Aluminium', 'concept21_aluminium', 'Sao Paulo', 'SP', 1)
on conflict (key) do update set name = excluded.name, city = excluded.city, state = excluded.state;

insert into public.departments (name, key, sort_order)
values
  ('Diretoria', 'diretoria', 1),
  ('Administrativo', 'administrativo', 2),
  ('Financeiro', 'financeiro', 3),
  ('RH', 'rh', 4),
  ('Suprimentos', 'suprimentos', 5),
  ('Engenharia', 'engenharia', 6),
  ('Produção', 'producao', 7),
  ('Obras', 'obras', 8),
  ('Instalacoes', 'instalacoes', 9),
  ('Comercial', 'comercial', 10)
on conflict (key) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.employment_types (name, key, sort_order)
values
  ('CLT', 'clt', 1),
  ('PJ', 'pj', 2),
  ('Estagiário', 'estagiario', 3),
  ('Temporário', 'temporario', 4),
  ('Terceirizado', 'terceirizado', 5)
on conflict (key) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.employee_statuses (name, key, color, is_terminal, sort_order)
values
  ('Ativo', 'ativo', 'green', false, 1),
  ('Inativo', 'inativo', 'neutral', true, 2),
  ('Em experiência', 'em_experiencia', 'orange', false, 3),
  ('Em férias', 'em_ferias', 'blue', false, 4),
  ('Afastado', 'afastado', 'red', false, 5),
  ('Desligado', 'desligado', 'neutral', true, 6)
on conflict (key) do update
set name = excluded.name, color = excluded.color, is_terminal = excluded.is_terminal, sort_order = excluded.sort_order;

insert into public.termination_reasons (name, key, sort_order)
values
  ('Pedido de demissão', 'pedido_demissao', 1),
  ('Demissão sem justa causa', 'demissao_sem_justa_causa', 2),
  ('Demissão por justa causa', 'demissao_justa_causa', 3),
  ('Término de contrato', 'termino_contrato', 4),
  ('Acordo entre as partes', 'acordo_partes', 5)
on conflict (key) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.document_types (name, key, requires_expiration_date, default_validity_months, sort_order)
values
  ('CPF', 'cpf', false, null, 1),
  ('RG', 'rg', false, null, 2),
  ('Comprovante de residencia', 'comprovante_residencia', false, null, 3),
  ('Contrato de trabalho', 'contrato_trabalho', false, null, 4),
  ('ASO admissional', 'aso_admissional', true, 12, 5),
  ('ASO periódico', 'aso_periodico', true, 12, 6),
  ('Ficha de EPI', 'ficha_epi', false, null, 7),
  ('CNH', 'cnh', true, null, 8),
  ('Certificado NR-35', 'certificado_nr_35', true, 24, 9),
  ('Certificado NR-18', 'certificado_nr_18', true, 24, 10),
  ('Certificado NR-12', 'certificado_nr_12', true, 24, 11)
on conflict (key) do update
set
  name = excluded.name,
  requires_expiration_date = excluded.requires_expiration_date,
  default_validity_months = excluded.default_validity_months,
  sort_order = excluded.sort_order;

insert into public.occurrence_categories (name, key, sort_order)
values
  ('Disciplinar', 'disciplinar', 1),
  ('Operacional', 'operacional', 2),
  ('Segurança', 'seguranca', 3),
  ('Administrativa', 'administrativa', 4),
  ('Reconhecimento', 'reconhecimento', 5),
  ('Movimentação interna', 'movimentacao_interna', 6),
  ('Desligamento', 'desligamento', 7)
on conflict (key) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.occurrence_types (
  name,
  key,
  occurrence_category_id,
  requires_attachment,
  requires_approval,
  visible_to_employee,
  visible_to_manager,
  generates_alert,
  impacts_history,
  sort_order
)
values
  ('Advertência verbal', 'advertencia_verbal', (select id from public.occurrence_categories where key = 'disciplinar'), false, false, false, true, true, true, 1),
  ('Advertência escrita', 'advertencia_escrita', (select id from public.occurrence_categories where key = 'disciplinar'), false, true, false, true, true, true, 2),
  ('Suspensão', 'suspensao', (select id from public.occurrence_categories where key = 'disciplinar'), false, true, false, true, true, true, 3),
  ('Elogio', 'elogio', (select id from public.occurrence_categories where key = 'reconhecimento'), false, false, true, true, false, true, 4),
  ('Feedback', 'feedback', (select id from public.occurrence_categories where key = 'administrativa'), false, false, true, true, false, true, 5),
  ('Atraso', 'atraso', (select id from public.occurrence_categories where key = 'operacional'), false, false, false, true, true, true, 6),
  ('Falta sem justificativa', 'falta_sem_justificativa', (select id from public.occurrence_categories where key = 'operacional'), false, false, false, true, true, true, 7),
  ('Acidente', 'acidente', (select id from public.occurrence_categories where key = 'seguranca'), false, true, false, true, true, true, 8),
  ('Incidente', 'incidente', (select id from public.occurrence_categories where key = 'seguranca'), false, false, false, true, true, true, 9),
  ('Entrega de EPI', 'entrega_epi', (select id from public.occurrence_categories where key = 'seguranca'), false, false, true, true, false, true, 10),
  ('Devolução de EPI', 'devolucao_epi', (select id from public.occurrence_categories where key = 'seguranca'), false, false, true, true, false, true, 11),
  ('Alteração de cargo', 'alteracao_cargo', (select id from public.occurrence_categories where key = 'movimentacao_interna'), false, true, true, true, false, true, 12),
  ('Promoção', 'promocao', (select id from public.occurrence_categories where key = 'movimentacao_interna'), false, true, true, true, false, true, 13),
  ('Desligamento', 'desligamento', (select id from public.occurrence_categories where key = 'desligamento'), false, true, false, true, true, true, 14)
on conflict (key) do update
set
  name = excluded.name,
  occurrence_category_id = excluded.occurrence_category_id,
  requires_attachment = excluded.requires_attachment,
  requires_approval = excluded.requires_approval,
  visible_to_employee = excluded.visible_to_employee,
  visible_to_manager = excluded.visible_to_manager,
  generates_alert = excluded.generates_alert,
  impacts_history = excluded.impacts_history,
  sort_order = excluded.sort_order;

insert into public.trainings (name, key, description, validity_months, is_required, sort_order)
values
  ('Integração', 'integracao', 'Treinamento de integração de novos colaboradores.', null, true, 1),
  ('Uso de EPI', 'uso_epi', 'Uso correto de equipamentos de protecao individual.', 12, true, 2),
  ('NR-35', 'nr_35', 'Trabalho em altura.', 24, false, 3),
  ('NR-18', 'nr_18', 'Condições de segurança na indústria da construção.', 24, false, 4),
  ('NR-12', 'nr_12', 'Segurança no trabalho em máquinas e equipamentos.', 24, false, 5),
  ('Segurança no trabalho', 'seguranca_trabalho', 'Treinamento interno de segurança.', 12, true, 6)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  validity_months = excluded.validity_months,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order;

insert into public.leave_types (name, key, requires_document, sort_order)
values
  ('Atestado médico', 'atestado_medico', true, 1),
  ('Licença maternidade', 'licenca_maternidade', true, 2),
  ('Licença paternidade', 'licenca_paternidade', true, 3),
  ('Afastamento INSS', 'afastamento_inss', true, 4),
  ('Licença sem vencimentos', 'licenca_sem_vencimentos', false, 5)
on conflict (key) do update
set name = excluded.name, requires_document = excluded.requires_document, sort_order = excluded.sort_order;

insert into public.roles (name, key, description, is_system)
values
  ('Master', 'master', 'Acesso total e permanente ao sistema.', true),
  ('RH', 'rh', 'Operação completa do módulo de Recursos Humanos.', true),
  ('Diretoria', 'diretoria', 'Visao gerencial e acesso a indicadores sensiveis.', true),
  ('Financeiro', 'financeiro', 'Acesso limitado a informacoes administrativas.', true),
  ('Gestor', 'gestor', 'Gestao de equipe conforme escopo configurado.', true),
  ('Colaborador', 'colaborador', 'Acesso aos próprios dados quando o portal for ativado.', true),
  ('Operacional', 'operacional', 'Acesso operacional restrito.', true)
on conflict (key) do update
set name = excluded.name, description = excluded.description, is_system = excluded.is_system;

insert into public.permissions (module, action, key, description, is_sensitive)
values
  ('dashboard', 'view', 'hr.dashboard.view', 'Visualizar dashboard de RH.', false),
  ('dashboard', 'turnover_view', 'hr.dashboard.turnover.view', 'Visualizar indicadores de turnover do dashboard de RH.', true),
  ('dashboard', 'costs_view', 'hr.dashboard.costs.view', 'Visualizar indicadores financeiros do dashboard de RH.', true),
  ('dashboard', 'charts_view', 'hr.dashboard.charts.view', 'Visualizar graficos gerenciais do dashboard de RH.', false),
  ('employees', 'view', 'hr.employees.view', 'Visualizar colaboradores.', true),
  ('employees', 'create', 'hr.employees.create', 'Criar colaboradores.', true),
  ('employees', 'edit', 'hr.employees.edit', 'Editar colaboradores.', true),
  ('employees', 'inactivate', 'hr.employees.inactivate', 'Inativar ou desligar colaboradores.', true),
  ('employees', 'export', 'hr.employees.export', 'Exportar dados de colaboradores.', true),
  ('employees', 'sensitive', 'hr.employees.sensitive.view', 'Visualizar dados sensiveis de colaboradores.', true),
  ('documents', 'view', 'hr.documents.view', 'Visualizar documentos de colaboradores.', true),
  ('documents', 'create', 'hr.documents.create', 'Enviar documentos de colaboradores.', true),
  ('documents', 'approve', 'hr.documents.approve', 'Aprovar documentos de colaboradores.', true),
  ('documents', 'reject', 'hr.documents.reject', 'Recusar documentos de colaboradores.', true),
  ('documents', 'download', 'hr.documents.download', 'Gerar URL assinada para documentos.', true),
  ('documents', 'manage', 'hr.documents.manage', 'Gerenciar documentos e anexos do RH.', true),
  ('vacations', 'view', 'hr.vacations.view', 'Visualizar férias.', false),
  ('vacations', 'create', 'hr.vacations.create', 'Criar solicitações de férias.', false),
  ('vacations', 'approve', 'hr.vacations.approve', 'Aprovar férias.', false),
  ('leaves', 'view', 'hr.leaves.view', 'Visualizar afastamentos.', true),
  ('leaves', 'create', 'hr.leaves.create', 'Criar afastamentos.', true),
  ('leaves', 'approve', 'hr.leaves.approve', 'Aprovar afastamentos.', true),
  ('trainings', 'view', 'hr.trainings.view', 'Visualizar treinamentos.', false),
  ('trainings', 'edit', 'hr.trainings.edit', 'Criar e editar treinamentos.', false),
  ('occurrences', 'view', 'hr.occurrences.view', 'Visualizar ocorrências.', true),
  ('occurrences', 'create', 'hr.occurrences.create', 'Criar ocorrências.', true),
  ('occurrences', 'edit', 'hr.occurrences.edit', 'Editar ocorrências.', true),
  ('occurrences', 'restricted', 'hr.occurrences.restricted.view', 'Visualizar ocorrências restritas.', true),
  ('settings', 'view', 'hr.settings.view', 'Visualizar configurações do RH.', false),
  ('settings', 'manage', 'hr.settings.manage', 'Gerenciar cadastros e regras do RH.', true),
  ('security', 'users_view', 'hr.security.users.view', 'Visualizar usuários e perfis.', true),
  ('security', 'users_manage', 'hr.security.users.manage', 'Gerenciar usuários, perfis e permissões.', true),
  ('audit', 'view', 'hr.audit.view', 'Visualizar auditoria.', true),
  ('audit', 'create', 'hr.audit.create', 'Registrar eventos de auditoria.', false),
  ('custom_fields', 'manage', 'hr.custom_fields.manage', 'Gerenciar campos personalizados.', true),
  ('imports', 'create', 'hr.imports.create', 'Importar planilhas de RH.', true)
on conflict (key) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
cross join public.permissions p
where r.key = 'master'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.dashboard.view',
  'hr.dashboard.turnover.view',
  'hr.dashboard.costs.view',
  'hr.dashboard.charts.view',
  'hr.employees.view',
  'hr.employees.create',
  'hr.employees.edit',
  'hr.employees.inactivate',
  'hr.employees.export',
  'hr.employees.sensitive.view',
  'hr.documents.view',
  'hr.documents.create',
  'hr.documents.approve',
  'hr.documents.reject',
  'hr.documents.download',
  'hr.documents.manage',
  'hr.vacations.view',
  'hr.vacations.create',
  'hr.vacations.approve',
  'hr.leaves.view',
  'hr.leaves.create',
  'hr.leaves.approve',
  'hr.trainings.view',
  'hr.trainings.edit',
  'hr.occurrences.view',
  'hr.occurrences.create',
  'hr.occurrences.edit',
  'hr.occurrences.restricted.view',
  'hr.settings.view',
  'hr.settings.manage',
  'hr.audit.view',
  'hr.audit.create',
  'hr.custom_fields.manage',
  'hr.imports.create'
)
where r.key = 'rh'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.dashboard.view',
  'hr.dashboard.turnover.view',
  'hr.dashboard.costs.view',
  'hr.dashboard.charts.view',
  'hr.employees.view',
  'hr.employees.export',
  'hr.documents.view',
  'hr.vacations.view',
  'hr.leaves.view',
  'hr.trainings.view',
  'hr.occurrences.view',
  'hr.audit.view'
)
where r.key = 'diretoria'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'own_department'
from public.roles r
join public.permissions p on p.key in (
  'hr.dashboard.view',
  'hr.dashboard.turnover.view',
  'hr.dashboard.charts.view',
  'hr.employees.view',
  'hr.vacations.view',
  'hr.leaves.view',
  'hr.trainings.view',
  'hr.occurrences.view',
  'hr.occurrences.create',
  'hr.vacations.approve'
)
where r.key = 'gestor'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'own_data'
from public.roles r
join public.permissions p on p.key in (
  'hr.employees.view',
  'hr.documents.view',
  'hr.vacations.view',
  'hr.leaves.view',
  'hr.trainings.view'
)
where r.key = 'colaborador'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.dashboard.view',
  'hr.dashboard.costs.view',
  'hr.dashboard.charts.view',
  'hr.employees.view'
)
where r.key = 'financeiro'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.key in (
  'hr.dashboard.view',
  'hr.employees.view'
)
where r.key = 'operacional'
on conflict (role_id, permission_id) do update set scope = excluded.scope;

insert into public.alert_rules (name, key, entity, event, days_before, severity)
values
  ('Documentos vencendo em 30 dias', 'documents_expiring_30_days', 'employee_document', 'expiration_date', 30, 'warning'),
  ('Documentos vencidos', 'documents_expired', 'employee_document', 'expiration_date', 0, 'critical'),
  ('Treinamentos vencendo em 30 dias', 'trainings_expiring_30_days', 'employee_training', 'expiration_date', 30, 'warning'),
  ('Férias próximas', 'vacations_starting_15_days', 'vacation', 'vacation_start', 15, 'info'),
  ('Afastamentos em andamento', 'leaves_in_progress', 'employee_leave', 'start_date', null, 'warning')
on conflict (key) do update
set
  name = excluded.name,
  entity = excluded.entity,
  event = excluded.event,
  days_before = excluded.days_before,
  severity = excluded.severity;

insert into public.custom_fields (entity, label, key, field_type, sort_order)
values
  ('employee', 'Tamanho da camisa', 'shirt_size', 'select', 1),
  ('employee', 'Tamanho da bota', 'boot_size', 'text', 2),
  ('employee', 'Número do armário', 'locker_number', 'text', 3),
  ('employee', 'Possui veículo próprio?', 'has_own_vehicle', 'boolean', 4),
  ('employee', 'Disponibilidade para viagem', 'travel_availability', 'boolean', 5),
  ('employee', 'Equipe de instalação', 'installation_team', 'text', 6),
  ('employee', 'Região de atendimento', 'service_region', 'text', 7),
  ('employee', 'Codigo interno antigo', 'legacy_internal_code', 'text', 8)
on conflict (entity, key) do update
set label = excluded.label, field_type = excluded.field_type, sort_order = excluded.sort_order;

insert into public.custom_field_options (custom_field_id, label, value, sort_order)
select cf.id, option_label, option_value, option_order
from public.custom_fields cf
cross join (
  values
    ('P', 'p', 1),
    ('M', 'm', 2),
    ('G', 'g', 3),
    ('GG', 'gg', 4),
    ('XG', 'xg', 5)
) as options(option_label, option_value, option_order)
where cf.entity = 'employee' and cf.key = 'shirt_size'
on conflict (custom_field_id, value) do update
set label = excluded.label, sort_order = excluded.sort_order;
