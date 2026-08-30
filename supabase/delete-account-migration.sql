-- Secure self-service account deletion.
-- Run once in the Supabase SQL Editor after the secure game-session migration.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null then
    raise exception 'Authenticated account could not be found.';
  end if;

  -- Remove application-owned records explicitly. Dynamic SQL keeps this migration
  -- compatible with deployments where secure game_sessions was added separately.
  if to_regclass('public.game_sessions') is not null then
    execute 'delete from public.game_sessions where user_id = $1' using v_user_id;
  end if;

  delete from public.daily_scores where email = v_email;
  delete from public.high_scores where email = v_email;
  delete from public.app_users where email = v_email;

  -- The function runs as its database owner; clients never receive an admin key.
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
