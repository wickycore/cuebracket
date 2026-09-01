"use client";

import { createClient } from "@/lib/supabase/client";

export const MEDIA_BUCKET = "cuebracket-media";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Choose a JPG, PNG or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "The image must be 5 MB or smaller.";
  return null;
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadPublicImage(folder: string, file: File) {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in before uploading an image.");

  const safeFolder = folder.split("/").filter(Boolean).join("/");
  const path = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return {
    path,
    url: supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl,
  };
}

export async function uploadTournamentPoster(tournamentId: string, file: File) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in before uploading a tournament poster.");
  return uploadPublicImage(`tournaments/${user.id}/${tournamentId}/poster`, file);
}

export function mediaPathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  return decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0]);
}

export async function removePublicImage(url: string | null | undefined) {
  const path = mediaPathFromUrl(url);
  if (!path) return;
  const { error } = await createClient().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}
