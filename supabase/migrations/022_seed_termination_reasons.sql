insert into public.termination_reasons (name, key, description, sort_order)
values
  ('Pedido de demissao', 'pedido_demissao', 'Colaborador solicitou o desligamento.', 10),
  ('Dispensa sem justa causa', 'dispensa_sem_justa_causa', 'Empresa encerrou o vinculo sem justa causa.', 20),
  ('Dispensa com justa causa', 'dispensa_com_justa_causa', 'Empresa encerrou o vinculo com justa causa.', 30),
  ('Termino de contrato', 'termino_contrato', 'Encerramento por termino de contrato.', 40),
  ('Acordo entre as partes', 'acordo_entre_partes', 'Desligamento por acordo entre empresa e colaborador.', 50),
  ('Falecimento', 'falecimento', 'Desligamento por falecimento do colaborador.', 60),
  ('Outros', 'outros', 'Motivo nao classificado nas demais opcoes.', 70)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
