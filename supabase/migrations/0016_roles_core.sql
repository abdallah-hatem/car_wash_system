-- =============================================================================
-- Roles & permissions — core: JWT helpers, data model, profiles RLS, auth hook
-- See docs/superpowers/specs/2026-06-17-roles-permissions-design.md
-- =============================================================================

-- ---- 1. JWT claim helpers (read request.jwt.claims, like current_tenant_id) ----

create or replace function public.current_app_role() returns text
  language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role', '');
$$;

-- branch ids the caller is responsible for, as uuid[] (empty when absent / owner)
create or replace function public.current_branch_ids() returns uuid[]
  language sql stable as $$
  select coalesce(array(
    select (jsonb_array_elements_text(
      current_setting('request.jwt.claims', true)::jsonb -> 'branch_ids'))::uuid
  ), '{}'::uuid[]);
$$;

-- permission level ('none'|'view'|'edit') for a tab; default 'none'
create or replace function public.current_permission(tab text) returns text
  language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'permissions') ->> tab,
    'none');
$$;

-- owner sees all branches; a member only the branches assigned to them
create or replace function public.can_access_branch(b uuid) returns boolean
  language sql stable as $$
  select public.current_app_role() = 'owner' or b = any(public.current_branch_ids());
$$;

-- owner can edit everything; a member needs 'edit' on the tab
create or replace function public.can_edit(tab text) returns boolean
  language sql stable as $$
  select public.current_app_role() = 'owner' or public.current_permission(tab) = 'edit';
$$;

-- ---- 2. profiles: per-user permission map + active flag ----

alter table public.profiles
  add column if not exists permissions jsonb   not null default '{}'::jsonb,
  add column if not exists is_active   boolean not null default true;

-- ---- 3. user_branches: which branches a sub-user (manager) is responsible for ----

create table if not exists public.user_branches (
  tenant_id  uuid not null references public.tenants(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)      on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);
create index if not exists user_branches_tenant_user_idx
  on public.user_branches (tenant_id, user_id);

alter table public.user_branches enable row level security;
create policy tenant_isolation on public.user_branches
  for all
  using      (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---- 4. profiles RLS: owner reads all tenant profiles; a user reads their own.
--          No client writes (managed by the manage-users edge function / service_role).
--          (Replaces the generic tenant_isolation policy from 0008_rls.sql.) ----

drop policy if exists tenant_isolation on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    tenant_id = public.current_tenant_id()
    and (public.current_app_role() = 'owner' or user_id = auth.uid())
  );

-- ---- 5. auth hook: also inject permissions + branch_ids; withhold claims when inactive ----
-- Builds on 0011_auth_hook_app_role.sql. SECURITY DEFINER (runs as owner) so it
-- bypasses the profiles RLS above and still reads the row.

create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  claims    jsonb := event -> 'claims';
  uid       uuid  := (event ->> 'user_id')::uuid;
  prof      record;
  is_admin  boolean;
begin
  -- Inject tenant claims only when the profile is active AND the tenant is active.
  -- A deactivated member (is_active = false) gets no tenant_id/app_role -> /no-access.
  select p.tenant_id, p.role, p.permissions into prof
    from public.profiles p
    join public.tenants  t on t.id = p.tenant_id
    where p.user_id = uid and p.is_active and t.status = 'active';

  if found then
    claims := jsonb_set(claims, '{tenant_id}',   to_jsonb(prof.tenant_id::text));
    claims := jsonb_set(claims, '{app_role}',    to_jsonb(prof.role::text));
    claims := jsonb_set(claims, '{permissions}', coalesce(prof.permissions, '{}'::jsonb));
    claims := jsonb_set(claims, '{branch_ids}',
      (select coalesce(jsonb_agg(branch_id::text), '[]'::jsonb)
         from public.user_branches where user_id = uid));
  end if;

  select exists(select 1 from public.platform_admins where user_id = uid) into is_admin;
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(is_admin));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select on public.user_branches to supabase_auth_admin;
