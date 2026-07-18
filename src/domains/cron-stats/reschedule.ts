import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@/src/core/queue";
import { getRedisConnectionOptions } from "@/src/core/redis-connection";
import { getSetting } from "@/src/domains/settings/service";
import { logger } from "@/src/core/logger";

const DAILY_JOB_ID = "admin-daily-cron";
const HOURLY_JOB_ID = "renewals-hourly";

export async function rescheduleCronJobs() {
  const connection = getRedisConnectionOptions();
  const renewalsQueue = new Queue(QUEUE_NAMES.renewals, { connection });

  try {
    const repeatable = await renewalsQueue.getRepeatableJobs();
    for (const job of repeatable) {
      if (job.id === DAILY_JOB_ID || job.name === "daily") {
        await renewalsQueue.removeRepeatableByKey(job.key);
      }
      if (job.id === HOURLY_JOB_ID || job.name === "sweep") {
        await renewalsQueue.removeRepeatableByKey(job.key);
      }
    }

    await renewalsQueue.add(
      "sweep",
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        jobId: HOURLY_JOB_ID,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );

    const time = String(await getSetting("cron.time", "00:00"));
    const [hour, minute] = time.split(":").map((v) => Number(v) || 0);
    await renewalsQueue.add(
      "daily",
      {},
      {
        repeat: { pattern: `${minute} ${hour} * * *` },
        jobId: DAILY_JOB_ID,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );

    logger.info({ cronTime: time }, "Cron jobs rescheduled");
  } finally {
    await renewalsQueue.close();
  }
}
