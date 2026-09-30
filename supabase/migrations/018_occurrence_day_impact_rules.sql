begin;

update public.occurrence_types
set
  include_in_daily_report = false,
  counts_as_absence = false,
  counts_as_medical_certificate = false,
  priority_order = 99
where key in ('advertencia', 'advertencia_verbal', 'advertencia_escrita')
   or key like 'advertencia_%';

update public.occurrence_types
set
  counts_as_absence = false,
  counts_as_medical_certificate = false
where key = 'atraso'
   or key like 'atraso_%';

update public.occurrence_types
set include_in_daily_report = false
where key = 'atraso'
   or key like 'atraso_%';

update public.occurrence_types
set
  include_in_daily_report = true,
  counts_as_absence = true,
  counts_as_medical_certificate = false
where key = 'suspensao';

commit;
