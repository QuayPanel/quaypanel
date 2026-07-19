/** Upload an image via /api/v1/uploads and return the public URL. */
export async function uploadImageFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/v1/uploads", { method: "POST", body });
  const text = await res.text();
  let json: {
    data?: { url?: string };
    error?: { message?: string };
  } | null = null;
  try {
    json = text ? (JSON.parse(text) as typeof json) : null;
  } catch {
    throw new Error(
      res.ok
        ? "Upload returned an invalid response"
        : `Upload failed (${res.status}). Try JPEG, PNG, WebP, GIF, SVG, or ICO under 5MB.`,
    );
  }
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Upload failed (${res.status})`);
  }
  const url = json?.data?.url;
  if (!url) throw new Error("Upload succeeded but no URL was returned");
  return url;
}
