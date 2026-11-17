// Uploads photos for the guest website to Supabase Storage (bucket "site-photos", folder = hotel id).
// Photos are shrunk in the browser first so pages stay fast: a 6 MB phone photo becomes a few hundred KB.
import { supabase } from "@/integrations/supabase/client";

export type PhotoKind = "hero" | "gallery" | "feature" | "offer" | "room" | "main" | "logo";

const BUCKET = "site-photos";
const MAX_INPUT = 25 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Resize (keeping proportions) and re-encode. Logos keep transparency. */
const shrink = async (file: File, kind: PhotoKind): Promise<{ blob: Blob; ext: string }> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo can't be read here. Please use a JPG, PNG or WebP photo.");
  }
  const max = kind === "logo" ? 900 : kind === "hero" || kind === "main" ? 2400 : 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const transparent = kind === "logo" && file.type !== "image/jpeg";
  const webp = await toBlob(canvas, "image/webp", transparent ? 0.9 : 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  // Older browsers without WebP: PNG for logos, JPEG for photos.
  const fallback = await toBlob(canvas, transparent ? "image/png" : "image/jpeg", 0.85);
  if (!fallback) throw new Error("Your browser could not prepare the photo.");
  return { blob: fallback, ext: transparent ? "png" : "jpg" };
};

/** Uploads one photo and returns its public https link. */
export const uploadSitePhoto = async (hotelId: string, file: File, kind: PhotoKind): Promise<string> => {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not a photo.`);
  if (file.size > MAX_INPUT) throw new Error(`${file.name} is too big (over 25 MB).`);
  const { blob, ext } = await shrink(file, kind);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${hotelId}/${kind}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type, cacheControl: "31536000", upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error("Photo upload needs the database update 20261117190000_site_photos.sql first.");
    if (/row-level security|unauthorized|403/i.test(error.message)) throw new Error("Only owners and managers can upload website photos.");
    throw new Error(error.message);
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};
