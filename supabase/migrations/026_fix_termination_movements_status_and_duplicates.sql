begin;

create or replace function app.prevent_duplicate_active_termination_movement()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if new.movement_type = 'termination'
    and new.status <> 'cancelled'
    and new.is_active = true
    and new.deleted_at is null
    and exists (
      select 1
      from public.employee_movements existing
      where existing.employee_id = new.employee_id
        and existing.movement_type = 'termination'
        and existing.status <> 'cancelled'
        and existing.is_active = true
        and existing.deleted_at is null
        and existing.id <> new.id
    )
  then
    raise exception 'Este colaborador já possui um desligamento registrado. Exclua ou cancele o desligamento existente antes de registrar outro.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_active_termination_movement on public.employee_movements;
create trigger prevent_duplicate_active_termination_movement
before insert or update on public.employee_movements
for each row execute function app.prevent_duplicate_active_termination_movement();

with desligado_status as (
  select id
  from public.employee_statuses
  where key = 'desligado'
    and is_active = true
  limit 1
),
latest_completed_movement as (
  select distinct on (m.employee_id)
    m.employee_id,
    m.movement_type,
    m.movement_date,
    m.termination_reason_id
  from public.employee_movements m
  where m.status = 'completed'
    and m.is_active = true
    and m.deleted_at is null
  order by m.employee_id, m.movement_date desc, m.created_at desc, m.id desc
)
update public.employees e
set
  is_active = false,
  termination_date = latest_completed_movement.movement_date,
  termination_reason_id = latest_completed_movement.termination_reason_id,
  status_id = desligado_status.id,
  updated_at = now()
from latest_completed_movement
cross join desligado_status
where e.id = latest_completed_movement.employee_id
  and latest_completed_movement.movement_type = 'termination'
  and (
    e.is_active is distinct from false
    or e.termination_date is distinct from latest_completed_movement.movement_date
    or e.termination_reason_id is distinct from latest_completed_movement.termination_reason_id
    or e.status_id is distinct from desligado_status.id
  );

commit;
