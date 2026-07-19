const MAX_CLIENT_BYTES = 5 * 1024 * 1024;

type UploadResponse = {
  data?: { url?: string };
  error?: { message?: string };
};

/** Upload an image via /api/v1/uploads and return the public URL. */
export async function uploadImageFile(file: File): Promise<string> {
  if (file.size > MAX_CLIENT_BYTES) {
    throw new Error("Image must be 5MB or smaller");
  }

  const qs = new URLSearchParams({ name: file.name || "upload.png" });
  const res = await fetch(`/api/v1/uploads?${qs.toString()}`, {
    method: "POST",
    body: file,
    credentials: "same-origin",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Quay-Portal": "admin",
      "X-File-Name": encodeURIComponent(file.name || "upload.png"),
    },
  });

  const text = await res.text();
  let json: UploadResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as UploadResponse) : null;
  } catch {
    if (res.status === 413) {
      throw new Error(
        "Upload rejected as too large (413). If you use Nginx, set client_max_body_size 10m; then reload Nginx.",
      );
    }
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
