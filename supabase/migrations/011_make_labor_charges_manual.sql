begin;

update public.cost_components
set
  calculation_type = 'fixed_monthly',
  default_value = 0.00,
  default_percentage = null,
  applies_to = 'manual',
  description = case key
    when 'fgts' then 'Valor mensal informado para custo real do colaborador.'
    when 'inss_patronal' then 'Valor mensal informado para encargos patronais.'
    when 'rat' then 'Valor mensal informado para risco ambiental do trabalho.'
    when 'fap' then 'Valor mensal informado para fator acidentario de prevencao.'
    when 'terceiros_sistema_s' then 'Valor mensal informado para terceiros e Sistema S.'
    when 'provisao_13_salario' then 'Valor mensal informado para provisao de 13 salario.'
    when 'provisao_ferias' then 'Valor mensal informado para provisao de ferias.'
    when 'provisao_um_terco_ferias' then 'Valor mensal informado para um terco de ferias.'
    when 'fgts_sobre_provisoes' then 'Valor mensal informado para reflexos sobre provisoes.'
    else description
  end
where key in (
  'fgts',
  'inss_patronal',
  'rat',
  'fap',
  'terceiros_sistema_s',
  'provisao_13_salario',
  'provisao_ferias',
  'provisao_um_terco_ferias',
  'fgts_sobre_provisoes'
);

commit;
