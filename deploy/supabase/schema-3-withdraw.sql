-- ttsstudio Supabase schema #3: self-service account withdrawal.
-- Run in the Supabase SQL Editor. Idempotent.

-- A logged-in user marks their own profile as withdrawn. (No self-UPDATE policy
-- exists, so this SECURITY DEFINER function is the only path — and it can only
-- ever touch the caller's own row.)
create or replace function public.withdraw_self()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set status = 'withdrawn' where id = auth.uid();
end; $$;

grant execute on function public.withdraw_self() to authenticated;
