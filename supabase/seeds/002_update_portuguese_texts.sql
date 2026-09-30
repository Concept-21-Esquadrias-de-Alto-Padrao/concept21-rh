begin;

update public.company_units as target
set city = source.city
from (
  values
    ('concept21_aluminium', 'São Paulo')
) as source(key, city)
where target.key = source.key;

update public.departments as target
set name = source.name
from (
  values
    ('producao', 'Produção'),
    ('instalacoes', 'Instalações')
) as source(key, name)
where target.key = source.key;

update public.employment_types as target
set name = source.name
from (
  values
    ('estagiario', 'Estagiário'),
    ('temporario', 'Temporário')
) as source(key, name)
where target.key = source.key;

update public.employee_statuses as target
set name = source.name
from (
  values
    ('em_experiencia', 'Em experiência'),
    ('em_ferias', 'Em férias')
) as source(key, name)
where target.key = source.key;

update public.termination_reasons as target
set name = source.name
from (
  values
    ('pedido_demissao', 'Pedido de demissão'),
    ('demissao_sem_justa_causa', 'Demissão sem justa causa'),
    ('demissao_justa_causa', 'Demissão por justa causa'),
    ('termino_contrato', 'Término de contrato')
) as source(key, name)
where target.key = source.key;

update public.document_types as target
set name = source.name
from (
  values
    ('comprovante_residencia', 'Comprovante de residência'),
    ('aso_periodico', 'ASO periódico')
) as source(key, name)
where target.key = source.key;

update public.occurrence_categories as target
set name = source.name
from (
  values
    ('seguranca', 'Segurança'),
    ('movimentacao_interna', 'Movimentação interna')
) as source(key, name)
where target.key = source.key;

update public.occurrence_types as target
set name = source.name
from (
  values
    ('advertencia_verbal', 'Advertência verbal'),
    ('advertencia_escrita', 'Advertência escrita'),
    ('suspensao', 'Suspensão'),
    ('devolucao_epi', 'Devolução de EPI'),
    ('alteracao_cargo', 'Alteração de cargo'),
    ('promocao', 'Promoção')
) as source(key, name)
where target.key = source.key;

update public.trainings as target
set name = source.name,
    description = source.description
from (
  values
    ('integracao', 'Integração', 'Treinamento de integração de novos colaboradores.'),
    ('uso_epi', 'Uso de EPI', 'Uso correto de equipamentos de proteção individual.'),
    ('nr_18', 'NR-18', 'Condições de segurança na indústria da construção.'),
    ('nr_12', 'NR-12', 'Segurança no trabalho em máquinas e equipamentos.'),
    ('seguranca_trabalho', 'Segurança no trabalho', 'Treinamento interno de segurança.')
) as source(key, name, description)
where target.key = source.key;

update public.leave_types as target
set name = source.name
from (
  values
    ('atestado_medico', 'Atestado médico'),
    ('licenca_maternidade', 'Licença maternidade'),
    ('licenca_paternidade', 'Licença paternidade'),
    ('licenca_sem_vencimentos', 'Licença sem vencimentos')
) as source(key, name)
where target.key = source.key;

update public.roles as target
set description = source.description
from (
  values
    ('rh', 'Operação completa do módulo de Recursos Humanos.'),
    ('diretoria', 'Visão gerencial e acesso a indicadores sensíveis.'),
    ('financeiro', 'Acesso limitado a informações administrativas.'),
    ('gestor', 'Gestão de equipe conforme escopo configurado.'),
    ('colaborador', 'Acesso aos próprios dados quando o portal for ativado.')
) as source(key, description)
where target.key = source.key;

update public.permissions as target
set description = source.description
from (
  values
    ('hr.employees.sensitive.view', 'Visualizar dados sensíveis de colaboradores.'),
    ('hr.vacations.view', 'Visualizar férias.'),
    ('hr.vacations.create', 'Criar solicitações de férias.'),
    ('hr.vacations.approve', 'Aprovar férias.'),
    ('hr.occurrences.view', 'Visualizar ocorrências.'),
    ('hr.occurrences.create', 'Criar ocorrências.'),
    ('hr.occurrences.edit', 'Editar ocorrências.'),
    ('hr.occurrences.restricted.view', 'Visualizar ocorrências restritas.'),
    ('hr.settings.view', 'Visualizar configurações do RH.'),
    ('hr.security.users.view', 'Visualizar usuários e perfis.'),
    ('hr.security.users.manage', 'Gerenciar usuários, perfis e permissões.')
) as source(key, description)
where target.key = source.key;

update public.alert_rules as target
set name = source.name
from (
  values
    ('vacations_starting_15_days', 'Férias próximas')
) as source(key, name)
where target.key = source.key;

update public.custom_fields as target
set label = source.label
from (
  values
    ('employee', 'locker_number', 'Número do armário'),
    ('employee', 'has_own_vehicle', 'Possui veículo próprio?'),
    ('employee', 'installation_team', 'Equipe de instalação'),
    ('employee', 'service_region', 'Região de atendimento'),
    ('employee', 'legacy_internal_code', 'Código interno antigo')
) as source(entity, key, label)
where target.entity = source.entity
  and target.key = source.key;

commit;
