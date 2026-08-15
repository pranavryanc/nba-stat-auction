-- NBA Stat Auction username migration
-- Run this in Supabase SQL Editor AFTER the original supabase/schema.sql.

alter table public.app_users
  add column if not exists username text;

create unique index if not exists app_users_username_lower_unique
  on public.app_users ((lower(username)))
  where username is not null;

create or replace function public.set_my_username(
  p_email text,
  p_username text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := trim(p_username);
begin
  if p_email <> (auth.jwt() ->> 'email') then
    raise exception 'Not authorized';
  end if;

  if v_username !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Username must be 3-20 characters and use only letters, numbers, underscores, or periods.';
  end if;

  insert into public.app_users(email, username)
  values (p_email, v_username)
  on conflict (email) do update
    set username = excluded.username;

  return v_username;
exception
  when unique_violation then
    raise exception 'That username is already taken.';
end;
$$;

create or replace function public.get_daily_leaderboard(
  p_challenge_date date,
  p_limit integer default 10
) returns table (
  player_label text,
  score integer,
  projected_wins integer,
  net_rating numeric,
  spent integer,
  lineup jsonb,
  achieved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(au.username, 'Player ' || upper(substr(md5(ds.email), 1, 6))) as player_label,
    ds.score,
    ds.projected_wins,
    ds.net_rating,
    ds.spent,
    ds.lineup,
    ds.achieved_at
  from public.daily_scores ds
  left join public.app_users au on au.email = ds.email
  where ds.challenge_date = p_challenge_date
  order by ds.score desc, ds.projected_wins desc, ds.net_rating desc, ds.spent asc, ds.achieved_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke execute on function public.set_my_username(text,text) from public, anon;
grant execute on function public.set_my_username(text,text) to authenticated;

revoke execute on function public.get_daily_leaderboard(date,integer) from public, anon;
grant execute on function public.get_daily_leaderboard(date,integer) to authenticated;
