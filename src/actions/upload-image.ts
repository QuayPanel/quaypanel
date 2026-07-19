"use server";

import { getSessionUser } from "@/src/auth/session";
import { AppError } from "@/src/core/errors";
import { saveUploadedImage } from "@/src/core/upload";

export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadImageAction(
  formData: FormData,
): Promise<UploadImageResult> {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return { ok: false, error: "Forbidden" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Image file is required" };
  }

  try {
    const url = await saveUploadedImage(file);
    return { ok: true, url };
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Upload failed";
    return { ok: false, error: message };
  }
}
