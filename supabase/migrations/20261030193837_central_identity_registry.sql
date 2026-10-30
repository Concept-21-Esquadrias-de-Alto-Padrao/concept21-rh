begin;

-- Corporate identities are independent of the UUIDs issued by each module's Auth project.
-- These tables are not a permission source and must never be queried from a browser client.
create table public.corporate_identities (
  id uuid primary key,
  review_group text not null unique check (review_group ~ '^V[0-9]{2}$'),
  display_name text not null check (length(btrim(display_name)) > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  approved_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.corporate_account_links (
  id uuid primary key default gen_random_uuid(),
  corporate_identity_id uuid not null references public.corporate_identities(id),
  module_key text not null check (module_key in ('rh', 'technical', 'production', 'works', 'activities', 'supplies')),
  source_project_ref text not null check (source_project_ref ~ '^[a-z0-9]{20}$'),
  source_profile_id uuid not null,
  source_auth_user_id uuid not null,
  source_active_at_review boolean not null,
  approved_on date not null,
  created_at timestamptz not null default now(),
  unique (source_project_ref, source_profile_id),
  unique (source_project_ref, source_auth_user_id)
);

create index corporate_account_links_identity_idx
  on public.corporate_account_links (corporate_identity_id, module_key);

alter table public.corporate_identities enable row level security;
alter table public.corporate_account_links enable row level security;

-- No client role can read or mutate the registry, even if Data API defaults change.
revoke all on public.corporate_identities, public.corporate_account_links
  from public, anon, authenticated;
grant select on public.corporate_identities, public.corporate_account_links
  to service_role;

comment on table public.corporate_identities is
  'Explicitly approved cross-module identity groups; not a source of application permissions.';
comment on table public.corporate_account_links is
  'Audited legacy Auth/profile references. Module access is still decided by that module.';

commit;
