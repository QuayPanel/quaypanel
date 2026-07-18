import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  getPublicSettings,
  getSettingsMap,
  maskSecrets,
  settingsUpdateSchema,
  updateSettings,
} from "@/src/domains/settings/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    const isPublic = new URL(req.url).searchParams.get("public") === "1";
    const map = await getSettingsMap();
    if (isPublic) {
      return jsonOk(getPublicSettings(map));
    }
    requireStaff(auth);
    return jsonOk(maskSecrets(map));
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const body = settingsUpdateSchema.parse(await request.json());
    const map = await updateSettings(body);
    return jsonOk(maskSecrets(map));
  });
}
