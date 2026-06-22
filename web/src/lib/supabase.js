import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surfaced in the console during local dev if env is missing.
  console.warn("[ttsstudio] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set.");
}

export const supabase = createClient(url || "", anon || "");

// The admin signs in with username "admin"; we map it to a real Supabase email.
export const ADMIN_EMAIL = "admin@ttsstudio.app";

// Turn a login identifier into an email. Plain usernames map to a synthetic
// domain so non-email usernames still work with Supabase email auth.
export function toEmail(identifier) {
  const id = (identifier || "").trim();
  if (!id) return id;
  if (id.toLowerCase() === "admin") return ADMIN_EMAIL;
  if (id.includes("@")) return id;
  return `${id.toLowerCase()}@ttsstudio.app`;
}
