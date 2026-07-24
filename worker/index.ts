import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAMES } from "../src/core/queue";
import { getRedisConnectionOptions } from "../src/core/redis-connection";
import { logger } from "../src/core/logger";
import { processEmailJob } from "../src/jobs/email";
import { processInvoicePaidJob } from "../src/jobs/invoices";
import { processProvisionJob } from "../src/jobs/provision";
import { processDailyCron, processRenewalsSweep } from "../src/jobs/renewals";
import { rescheduleCronJobs } from "../src/domains/cron-stats/reschedule";
import { loadBuiltInGateways } from "../src/plugins/registry";

const connection = getRedisConnectionOptions();

loadBuiltInGateways().catch((err) =>
  logger.error({ err }, "Failed to load payment gateways / plugins"),
);

const emailWorker = new Worker(QUEUE_NAMES.email, processEmailJob, {
  connection,
});

const invoiceWorker = new Worker(QUEUE_NAMES.invoices, processInvoicePaidJob, {
  connection,
});

const provisionWorker = new Worker(QUEUE_NAMES.provision, processProvisionJob, {
  connection,
});

const renewalsWorker = new Worker(
  QUEUE_NAMES.renewals,
  async (job) => {
    if (job.name === "daily") return processDailyCron(job);
    if (job.name === "reschedule") return rescheduleCronJobs();
    return processRenewalsSweep(job);
  },
  { connection },
);

async function scheduleJobs() {
  await rescheduleCronJobs();
}

scheduleJobs().catch((err) =>
  logger.error({ err }, "Failed to schedule cron jobs"),
);

for (const worker of [
  emailWorker,
  invoiceWorker,
  provisionWorker,
  renewalsWorker,
]) {
  worker.on("completed", (job) => {
    logger.info({ queue: worker.name, jobId: job.id }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error({ queue: worker.name, jobId: job?.id, err }, "Job failed");
  });
}

logger.info("QuayPanel workers started");
