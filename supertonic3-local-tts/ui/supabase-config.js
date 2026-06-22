// Supabase public config. The anon key is safe to expose in the browser:
// access is enforced by Row Level Security (see deploy/supabase/schema.sql).
window.TTS_SUPABASE = {
  SUPABASE_URL: "__SUPABASE_URL__",
  SUPABASE_ANON_KEY: "__SUPABASE_ANON_KEY__",
};
