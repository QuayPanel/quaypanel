import { withApi, jsonOk, jsonError } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { saveUploadedImageBytes } from "@/src/core/upload";
import { ValidationError } from "@/src/core/errors";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);

    const url = new URL(request.url);
    const fromQuery = url.searchParams.get("name")?.trim();
    const fromHeader = request.headers.get("x-file-name")?.trim();
    let name = fromQuery || "upload.png";
    if (!fromQuery && fromHeader) {
      try {
        name = decodeURIComponent(fromHeader);
      } catch {
        name = fromHeader;
      }
    }
    const type =
      request.headers.get("content-type")?.split(";")[0]?.trim() || "";

    let bytes: Buffer;
    try {
      bytes = Buffer.from(await request.arrayBuffer());
    } catch {
      throw new ValidationError("Could not read upload body");
    }

    if (bytes.byteLength === 0) {
      throw new ValidationError("Image file is required");
    }
    if (bytes.byteLength > MAX_BYTES) {
      throw new ValidationError("Image must be 5MB or smaller");
    }

    try {
      const publicUrl = await saveUploadedImageBytes({
        name,
        type: type === "application/octet-stream" ? "" : type,
        bytes,
      });
      return jsonOk({ url: publicUrl });
    } catch (err) {
      return jsonError(err);
    }
  });
}
