import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import {
  getCronStats,
  type CronStatsRange,
} from "@/src/domains/cron-stats/service";

const RANGES = new Set<CronStatsRange>(["today", "week", "month", "year"]);

export async function GET(request: Request) {
  return withApi(request, async ({ auth, request: req }) => {
    requireStaff(auth);
    const url = new URL(req.url);
    const raw = url.searchParams.get("range") ?? "week";
    const range: CronStatsRange = RANGES.has(raw as CronStatsRange)
      ? (raw as CronStatsRange)
      : "week";
    return jsonOk(await getCronStats(range));
  });
}
