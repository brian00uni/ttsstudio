import { supabase } from "./supabase";

const SESSION_KEY = "ttsstudio-visit-counted";

// Record one visit per browser session and return { total, today }.
// First load of a session calls record_visit() (increments); later loads call
// get_visit_counts() (read-only) so refreshes don't inflate the count.
// Requires deploy/supabase/schema-5-visits.sql to be applied.
export async function recordVisit() {
  const counted = sessionStorage.getItem(SESSION_KEY);
  const { data, error } = await supabase.rpc(counted ? "get_visit_counts" : "record_visit");
  if (error) throw error;
  if (!counted) sessionStorage.setItem(SESSION_KEY, "1");
  const row = Array.isArray(data) ? data[0] : data;
  return { total: Number(row?.total ?? 0), today: Number(row?.today ?? 0) };
}
