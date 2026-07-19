import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { saveUploadedImage } from "@/src/core/upload";
import { ValidationError } from "@/src/core/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError(
        "Could not read upload. File may be too large (max 5MB).",
      );
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("Image file is required");
    }
    const url = await saveUploadedImage(file);
    return jsonOk({ url });
  });
}
