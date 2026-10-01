begin;

update public.occurrence_types
set requires_attachment = false
where requires_attachment is true;

alter table public.occurrence_types
  alter column requires_attachment set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.occurrence_types'::regclass
      and conname = 'occurrence_types_requires_attachment_false'
  ) then
    alter table public.occurrence_types
      add constraint occurrence_types_requires_attachment_false
      check (requires_attachment = false)
      not valid;
  end if;
end;
$$;

alter table public.occurrence_types
  validate constraint occurrence_types_requires_attachment_false;

comment on column public.occurrence_types.requires_attachment is
  'Deprecated. Occurrences no longer accept attachments; kept false for historical compatibility.';

comment on table public.employee_occurrence_attachments is
  'Deprecated historical occurrence attachments. New application inserts are blocked by RLS.';

drop policy if exists "employee_occurrence_attachments_select" on public.employee_occurrence_attachments;
create policy "employee_occurrence_attachments_select"
on public.employee_occurrence_attachments for select to authenticated
using (
  exists (
    select 1
    from public.employee_occurrences o
    where o.id = employee_occurrence_attachments.occurrence_id
      and o.deleted_at is null
      and app.can_access_employee(o.employee_id, 'hr.occurrences.view')
  )
);

drop policy if exists "employee_occurrence_attachments_insert" on public.employee_occurrence_attachments;
create policy "employee_occurrence_attachments_insert_deprecated"
on public.employee_occurrence_attachments for insert to authenticated
with check (false);

drop policy if exists "storage_hr_documents_select" on storage.objects;
create policy "storage_hr_documents_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'hr-documents'
  and (
    app.can_access_employee_from_storage_path(name, 'hr.documents.view')
    or app.can_access_employee_from_storage_path(name, 'hr.documents.download')
    or exists (
      select 1
      from public.employee_occurrence_attachments a
      join public.employee_occurrences o on o.id = a.occurrence_id
      where a.storage_bucket = storage.objects.bucket_id
        and a.storage_path = storage.objects.name
        and o.deleted_at is null
        and app.can_access_employee(o.employee_id, 'hr.occurrences.view')
    )
  )
);

commit;
