/**
 * Client-side image optimisation before upload to Supabase Storage.
 *
 * Every image served from Storage counts towards the Supabase egress quota, and
 * the site shows most of them small (avatars, team logos in match cards). Images
 * are resized to the largest size the site actually uses for that folder and
 * re-encoded as WebP, keeping transparency. If the optimised file is not smaller,
 * or the browser cannot decode the format (e.g. SVG, GIF animations), the original
 * file is uploaded unchanged.
 */

/** Longest side, in pixels, per Storage folder (the biggest size it is displayed at, at 2x). */
const MAX_SIDE: Record<string, number> = {
  logos: 512,
  "players/profile": 720,
  "players/market": 720,
  "players/bg-less": 1200,
  awards: 1400,
  partners: 1200,
  "partners/activity": 1600,
  collaborations: 1600,
  social: 1600,
  media: 1600,
};
const DEFAULT_MAX_SIDE = 1600;
const QUALITY = 0.82;
const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

export function maxSideFor(folder: string): number {
  return MAX_SIDE[folder] ?? MAX_SIDE[folder.split("/")[0]] ?? DEFAULT_MAX_SIDE;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall back to an <img> element below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Returns a smaller WebP version of an image, or the original file when that is not possible. */
export async function optimizeImage(file: File, folder: string): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) return file;
  try {
    const source = await decode(file);
    const width = "naturalWidth" in source ? source.naturalWidth : source.width;
    const height = "naturalHeight" in source ? source.naturalHeight : source.height;
    if (!width || !height) return file;
    const scale = Math.min(1, maxSideFor(folder) / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ("close" in source) source.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    // Some browsers fall back to PNG when WebP encoding is unsupported: keep the original then.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], baseName + ".webp", { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
