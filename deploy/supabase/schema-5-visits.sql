-- ttsstudio Supabase schema: site visit counter (total + today).
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query -> Run).
-- Safe to re-run (idempotent).
--
-- One row per day. The RPCs are SECURITY DEFINER so the anon key can call them
-- without any direct table access (RLS stays locked down, no policies needed).
-- "today" is computed in KST so it matches the Korean local day.

create table if not exists public.visit_counts (
  day   date primary key,
  count bigint not null default 0
);

alter table public.visit_counts enable row level security;
-- No policies on purpose: only the SECURITY DEFINER functions below touch it.

-- Increment today's counter by one, then return the latest totals.
create or replace function public.record_visit()
returns table(total bigint, today bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.visit_counts (day, count)
  values (d, 1)
  on conflict (day) do update set count = visit_counts.count + 1;

  return query
    select coalesce(sum(count), 0)::bigint,
           coalesce(sum(count) filter (where day = d), 0)::bigint
    from public.visit_counts;
end;
$$;

-- Read-only totals (used on refreshes that should not increment the counter).
create or replace function public.get_visit_counts()
returns table(total bigint, today bigint)
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(count), 0)::bigint,
         coalesce(sum(count) filter (where day = (now() at time zone 'Asia/Seoul')::date), 0)::bigint
  from public.visit_counts;
$$;

grant execute on function public.record_visit() to anon, authenticated;
grant execute on function public.get_visit_counts() to anon, authenticated;
