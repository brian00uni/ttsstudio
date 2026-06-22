-- ttsstudio Supabase schema: generation history + per-user audio storage.
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query -> Run).
-- Safe to re-run (idempotent).

-- ---------- generations history table ----------
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  text        text not null,
  voice       text,
  lang        text,
  speed       real,
  total_step  int,
  duration    real,
  audio_path  text,                 -- storage object path: {user_id}/{file}.mp3
  mime        text default 'audio/mpeg'
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

drop policy if exists "generations_own_select" on public.generations;
create policy "generations_own_select" on public.generations
  for select using (auth.uid() = user_id);

drop policy if exists "generations_own_insert" on public.generations;
create policy "generations_own_insert" on public.generations
  for insert with check (auth.uid() = user_id);

drop policy if exists "generations_own_delete" on public.generations;
create policy "generations_own_delete" on public.generations
  for delete using (auth.uid() = user_id);

-- ---------- private audio storage bucket ----------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

-- Each user can only touch objects under a top-level folder named after their uid.
drop policy if exists "audio_own_read" on storage.objects;
create policy "audio_own_read" on storage.objects
  for select using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_own_insert" on storage.objects;
create policy "audio_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_own_delete" on storage.objects;
create policy "audio_own_delete" on storage.objects
  for delete using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );
