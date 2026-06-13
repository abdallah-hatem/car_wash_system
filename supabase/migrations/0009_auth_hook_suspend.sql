create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  claims    jsonb := event -> 'claims';
  uid       uuid  := (event ->> 'user_id')::uuid;
  prof      record;
  is_admin  boolean;
begin
  -- Only inject tenant claims when the tenant is active.
  -- Suspended tenants: profile row exists but the join filters it out,
  -- so tenant_id / role are simply not added to the claims.
  select p.tenant_id, p.role into prof
    from public.profiles p
    join public.tenants  t on t.id = p.tenant_id
    where p.user_id = uid and t.status = 'active';

  if found then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(prof.tenant_id::text));
    claims := jsonb_set(claims, '{role}',      to_jsonb(prof.role::text));
  end if;

  select exists(select 1 from public.platform_admins where user_id = uid) into is_admin;
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(is_admin));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage  on schema public to supabase_auth_admin;
grant select on public.profiles, public.platform_admins to supabase_auth_admin;
grant select on public.tenants to supabase_auth_admin;
