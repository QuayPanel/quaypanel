import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { AppError } from "@/src/core/errors";

const MAX_BYTES = 5 * 1024 * 1024;

/** MIME → file extension */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/ico": "ico",
};

const EXT_BY_NAME: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  svg: "svg",
  avif: "avif",
  ico: "ico",
};

function extensionFromName(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_BY_NAME[ext] ?? null;
}

function resolveImageExt(file: File): string {
  const fromMime = EXT_BY_MIME[file.type.toLowerCase()];
  if (fromMime) return fromMime;

  const fromName = extensionFromName(file.name);
  if (fromName) return fromName;

  throw new AppError(
    "Only JPEG, PNG, WebP, GIF, SVG, AVIF, or ICO images are allowed",
    400,
  );
}

export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new AppError("Image must be 5MB or smaller", 400);
  }

  const ext = resolveImageExt(file);
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${filename}`;
}
