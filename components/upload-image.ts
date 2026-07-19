"use client";

import { uploadImageAction } from "@/src/actions/upload-image";

/** Upload an image (logo, favicon, product art) and return the public URL. */
export async function uploadImageFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const result = await uploadImageAction(body);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.url;
}
