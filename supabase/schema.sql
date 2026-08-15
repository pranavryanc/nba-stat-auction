-- NBA Stat Auction backend schema
-- Run this in the Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  email text primary key,
  username text,
  created_at timestamptz not null default now()
);

alter table public.app_users add column if not exists username text;
create unique index if not exists app_users_username_lower_unique
  on public.app_users ((lower(username)))
  where username is not null;

create table if not exists public.high_scores (
  email text not null,
  mode text not null check (mode in ('classic','daily','unlimited','historic')),
  score integer not null check (score between 0 and 100),
  projected_wins integer not null,
  net_rating numeric not null,
  spent integer not null,
  lineup jsonb not null,
  achieved_at timestamptz not null default now(),
  primary key (email, mode)
);

create table if not exists public.daily_scores (
  challenge_date date not null,
  email text not null,
  score integer not null check (score between 0 and 100),
  projected_wins integer not null,
  net_rating numeric not null,
  spent integer not null,
  lineup jsonb not null,
  achieved_at timestamptz not null default now(),
  primary key (challenge_date, email)
);

alter table public.app_users enable row level security;
alter table public.high_scores enable row level security;
alter table public.daily_scores enable row level security;

create policy "Users can read their email row" on public.app_users
for select to authenticated using (email = (auth.jwt() ->> 'email'));
create policy "Users can insert their email row" on public.app_users
for insert to authenticated with check (email = (auth.jwt() ->> 'email'));

create policy "Users can read their own high scores" on public.high_scores
for select to authenticated using (email = (auth.jwt() ->> 'email'));

-- Daily score rows themselves are private. The public leaderboard is exposed only
-- through get_daily_leaderboard(), which returns an anonymous label rather than email.


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
  on conflict (email) do update set username = excluded.username;
  return v_username;
exception
  when unique_violation then
    raise exception 'That username is already taken.';
end;
$$;

create or replace function public.upsert_mode_high_score(
  p_email text,
  p_mode text,
  p_score integer,
  p_projected_wins integer,
  p_net_rating numeric,
  p_spent integer,
  p_lineup jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email <> (auth.jwt() ->> 'email') then
    raise exception 'Not authorized';
  end if;
  if p_mode not in ('classic','daily','unlimited','historic') then
    raise exception 'Invalid game mode';
  end if;

  insert into public.high_scores(email, mode, score, projected_wins, net_rating, spent, lineup)
  values (p_email, p_mode, p_score, p_projected_wins, p_net_rating, p_spent, p_lineup)
  on conflict (email, mode) do update
  set score = excluded.score,
      projected_wins = excluded.projected_wins,
      net_rating = excluded.net_rating,
      spent = excluded.spent,
      lineup = excluded.lineup,
      achieved_at = now()
  where excluded.score > public.high_scores.score
     or (excluded.score = public.high_scores.score and excluded.projected_wins > public.high_scores.projected_wins)
     or (excluded.score = public.high_scores.score and excluded.projected_wins = public.high_scores.projected_wins and excluded.net_rating > public.high_scores.net_rating)
     or (excluded.score = public.high_scores.score and excluded.projected_wins = public.high_scores.projected_wins and excluded.net_rating = public.high_scores.net_rating and excluded.spent < public.high_scores.spent);
end;
$$;

create or replace function public.upsert_daily_score(
  p_email text,
  p_challenge_date date,
  p_score integer,
  p_projected_wins integer,
  p_net_rating numeric,
  p_spent integer,
  p_lineup jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email <> (auth.jwt() ->> 'email') then
    raise exception 'Not authorized';
  end if;

  insert into public.daily_scores(challenge_date, email, score, projected_wins, net_rating, spent, lineup)
  values (p_challenge_date, p_email, p_score, p_projected_wins, p_net_rating, p_spent, p_lineup)
  on conflict (challenge_date, email) do update
  set score = excluded.score,
      projected_wins = excluded.projected_wins,
      net_rating = excluded.net_rating,
      spent = excluded.spent,
      lineup = excluded.lineup,
      achieved_at = now()
  where excluded.score > public.daily_scores.score
     or (excluded.score = public.daily_scores.score and excluded.projected_wins > public.daily_scores.projected_wins)
     or (excluded.score = public.daily_scores.score and excluded.projected_wins = public.daily_scores.projected_wins and excluded.net_rating > public.daily_scores.net_rating)
     or (excluded.score = public.daily_scores.score and excluded.projected_wins = public.daily_scores.projected_wins and excluded.net_rating = public.daily_scores.net_rating and excluded.spent < public.daily_scores.spent);
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

grant execute on function public.set_my_username(text,text) to authenticated;
grant execute on function public.upsert_mode_high_score(text,text,integer,integer,numeric,integer,jsonb) to authenticated;
grant execute on function public.upsert_daily_score(text,date,integer,integer,numeric,integer,jsonb) to authenticated;
grant execute on function public.get_daily_leaderboard(date,integer) to authenticated;

-- Explicit API privileges and function execution hardening.
grant select, insert on public.app_users to authenticated;
grant select on public.high_scores to authenticated;
revoke all on public.daily_scores from anon;
revoke all on public.daily_scores from authenticated;

revoke execute on function public.set_my_username(text,text) from public, anon;
revoke execute on function public.upsert_mode_high_score(text,text,integer,integer,numeric,integer,jsonb) from public, anon;
revoke execute on function public.upsert_daily_score(text,date,integer,integer,numeric,integer,jsonb) from public, anon;
revoke execute on function public.get_daily_leaderboard(date,integer) from public, anon;
grant execute on function public.upsert_mode_high_score(text,text,integer,integer,numeric,integer,jsonb) to authenticated;
grant execute on function public.upsert_daily_score(text,date,integer,integer,numeric,integer,jsonb) to authenticated;
grant execute on function public.get_daily_leaderboard(date,integer) to authenticated;
