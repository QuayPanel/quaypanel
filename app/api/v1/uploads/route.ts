import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { saveUploadedImage } from "@/src/core/upload";
import { ValidationError } from "@/src/core/errors";

export async function POST(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("Image file is required");
    }
    const url = await saveUploadedImage(file);
    return jsonOk({ url });
  });
}
