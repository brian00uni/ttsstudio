-- ttsstudio Supabase schema #4: store SRT subtitle text with each generation
-- so it survives the HF backend's ephemeral storage. Run in SQL Editor.
alter table public.generations add column if not exists srt_text text;
