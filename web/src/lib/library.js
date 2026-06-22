import { supabase } from "./supabase";

// Upload a finished generation's audio to Storage and record a history row.
export async function saveGeneration(userId, payload, result) {
  const audioUrl = result.mp3_url || result.audio_url;
  const blob = await (await fetch(audioUrl)).blob();
  const filename = audioUrl.split("/").pop().split("?")[0];
  const objectPath = `${userId}/${filename}`;
  const up = await supabase.storage
    .from("audio")
    .upload(objectPath, blob, { contentType: "audio/mpeg", upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from("generations").insert({
    user_id: userId,
    text: payload.text || "",
    voice: result.voice || payload.voice || null,
    lang: result.lang || payload.lang || null,
    speed: result.speed ?? payload.speed ?? null,
    total_step: result.total_step ?? payload.total_step ?? null,
    duration: result.duration ?? null,
    audio_path: objectPath,
    mime: "audio/mpeg",
  });
  if (error) throw error;
  return objectPath;
}

export async function listMyGenerations(limit = 50) {
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function signedUrl(path, expires = 3600) {
  const { data } = await supabase.storage.from("audio").createSignedUrl(path, expires);
  return data?.signedUrl || null;
}

export async function deleteGeneration(row) {
  await supabase.storage.from("audio").remove([row.audio_path]);
  await supabase.from("generations").delete().eq("id", row.id);
}
