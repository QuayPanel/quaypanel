import { Queue } from "bullmq";
import type { EmailTemplateKey } from "@/src/email/defaults";
import { getRedisConnectionOptions } from "./redis-connection";

const connection = getRedisConnectionOptions();

export const QUEUE_NAMES = {
  email: "email",
  invoices: "invoices",
  payments: "payments",
  provision: "provision",
  renewals: "renewals",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;
  const queue = new Queue(name, { connection });
  queues.set(name, queue);
  return queue;
}

export async function enqueueEmail(data: {
  to: string;
  subject: string;
  template: EmailTemplateKey;
  payload: Record<string, unknown>;
}) {
  try {
    return await getQueue(QUEUE_NAMES.email).add("send-email", data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  } catch {
    return null;
  }
}

export async function enqueueInvoicePaid(data: {
  invoiceId: string;
  paymentId: string;
}) {
  try {
    return await getQueue(QUEUE_NAMES.invoices).add("invoice-paid", data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  } catch {
    return null;
  }
}

export async function enqueueProvision(data: {
  action: "provision" | "suspend" | "unsuspend" | "terminate";
  serviceId: string;
  orderId?: string;
  providerId?: string;
}) {
  try {
    return await getQueue(QUEUE_NAMES.provision).add(data.action, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
  } catch {
    return null;
  }
}

export async function enqueueRenewalsSweep() {
  try {
    return await getQueue(QUEUE_NAMES.renewals).add(
      "sweep",
      {},
      {
        attempts: 1,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );
  } catch {
    return null;
  }
}
