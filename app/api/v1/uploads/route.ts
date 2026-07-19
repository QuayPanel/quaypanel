import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { saveUploadedImage } from "@/src/core/upload";
import { ValidationError } from "@/src/core/errors";

export const runtime = "nodejs";

/** Kept for API/script clients; the admin UI uses the uploadImageAction server action. */
export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError(
        "Could not read upload. File may be too large (max 5MB), or a reverse proxy is blocking it (413).",
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
