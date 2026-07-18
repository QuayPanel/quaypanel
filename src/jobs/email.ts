import type { Job } from "bullmq";
import { logger } from "@/src/core/logger";
import { sendTemplatedEmail } from "@/src/email/send";

export type EmailJobData = {
  to: string;
  subject: string;
  template: "invoice" | "receipt" | "welcome";
  payload: Record<string, unknown>;
};

export async function processEmailJob(job: Job<EmailJobData>) {
  logger.info({ jobId: job.id, to: job.data.to }, "Processing email job");
  await sendTemplatedEmail(job.data);
}
