-- ttsstudio Supabase schema #2: member profiles, roles, admin functions.
-- Run AFTER schema.sql, in the Supabase SQL Editor. Idempotent / re-runnable.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  is_admin    boolean not null default false,
  status      text not null default 'active',   -- 'active' | 'withdrawn'
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);
alter table public.profiles enable row level security;

-- Users may read their own profile. (No self-UPDATE policy: prevents a user
-- from setting their own is_admin/status. last_login is set via touch_login().)
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);

-- ---------- new-user trigger ----------
-- Creates a profile on signup. The fixed admin email is auto-promoted.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email = 'admin@ttsstudio.app'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this trigger existed.
insert into public.profiles (id, username, is_admin)
select u.id,
       coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
       u.email = 'admin@ttsstudio.app'
from auth.users u
on conflict (id) do nothing;

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Admins can read every profile (RLS).
drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
  for select using (public.is_admin());

-- Record last login for the calling user (avoids a self-UPDATE policy).
create or replace function public.touch_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_login = now() where id = auth.uid();
end; $$;

-- ---------- admin queries ----------
create or replace function public.admin_list_members()
returns table (
  id uuid, username text, email text, is_admin boolean, status text,
  created_at timestamptz, last_login timestamptz,
  generation_count bigint, total_duration double precision
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.id, p.username, u.email::text, p.is_admin, p.status, p.created_at, p.last_login,
           coalesce(g.cnt, 0)::bigint, coalesce(g.dur, 0)::double precision
    from public.profiles p
    join auth.users u on u.id = p.id
    left join (
      select user_id, count(*) cnt, sum(duration) dur
      from public.generations group by user_id
    ) g on g.user_id = p.id
    order by p.created_at desc;
end; $$;

create or replace function public.admin_set_status(target uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if new_status not in ('active', 'withdrawn') then raise exception 'bad status'; end if;
  update public.profiles set status = new_status where id = target;
end; $$;

grant execute on function public.touch_login() to authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
