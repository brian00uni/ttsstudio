import { supabase } from "./supabase";

// Upload a finished generation's audio to Storage and record a history row.
// The SRT subtitle text is stored inline (the backend's SRT file is ephemeral).
export async function saveGeneration(userId, payload, result) {
  const audioUrl = result.mp3_url || result.audio_url;
  const blob = await (await fetch(audioUrl)).blob();
  const filename = audioUrl.split("/").pop().split("?")[0];
  const objectPath = `${userId}/${filename}`;
  const up = await supabase.storage
    .from("audio")
    .upload(objectPath, blob, { contentType: "audio/mpeg", upsert: true });
  if (up.error) throw up.error;

  let srtText = null;
  if (result.srt_url) {
    try { srtText = await (await fetch(result.srt_url)).text(); } catch { /* optional */ }
  }

  const row = {
    user_id: userId,
    text: payload.text || "",
    voice: result.voice || payload.voice || null,
    lang: result.lang || payload.lang || null,
    speed: result.speed ?? payload.speed ?? null,
    total_step: result.total_step ?? payload.total_step ?? null,
    duration: result.duration ?? null,
    audio_path: objectPath,
    srt_text: srtText,
    mime: "audio/mpeg",
  };
  let { error } = await supabase.from("generations").insert(row);
  // If the srt_text column hasn't been added yet, save without it (don't lose the record).
  if (error && /srt_text/.test(error.message || "")) {
    delete row.srt_text;
    ({ error } = await supabase.from("generations").insert(row));
  }
  if (error) throw error;
  return objectPath;
}

// Paginated history. Returns { rows, count }.
export async function listGenerationsPage(page = 0, pageSize = 20) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await supabase
    .from("generations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function signedUrl(path, expires = 3600) {
  const { data } = await supabase.storage.from("audio").createSignedUrl(path, expires);
  return data?.signedUrl || null;
}

export async function deleteGeneration(row) {
  await supabase.storage.from("audio").remove([row.audio_path]);
  await supabase.from("generations").delete().eq("id", row.id);
}
