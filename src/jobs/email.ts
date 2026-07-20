import type { Job } from "bullmq";
import { logger } from "@/src/core/logger";
import { sendTemplatedEmail } from "@/src/email/send";
import type { EmailTemplateKey } from "@/src/email/defaults";

export type EmailJobData = {
  to: string;
  subject: string;
  template: EmailTemplateKey;
  payload: Record<string, unknown>;
};

export async function processEmailJob(job: Job<EmailJobData>) {
  logger.info({ jobId: job.id, to: job.data.to }, "Processing email job");
  await sendTemplatedEmail(job.data);
}
