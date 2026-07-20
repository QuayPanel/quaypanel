import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import { enqueueEmail } from "@/src/core/queue";
import { createTicket } from "@/src/domains/tickets/service";
import type {
  AutomationActionType,
  AutomationTrigger,
} from "@/src/generated/prisma/client";

export const automationRuleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  trigger: z.enum([
    "ORDER_PAID",
    "INVOICE_OVERDUE",
    "SERVICE_SUSPENDED",
    "SERVICE_TERMINATED",
    "TICKET_OPENED",
    "FRAUD_HOLD",
  ]),
  actionType: z.enum(["EMAIL", "WEBHOOK", "CREATE_TICKET"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function listAutomationRules() {
  return prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getAutomationRule(id: string) {
  const rule = await prisma.automationRule.findUnique({ where: { id } });
  if (!rule) throw new NotFoundError("Automation rule not found");
  return rule;
}

export async function createAutomationRule(
  data: z.infer<typeof automationRuleSchema>,
  actorId?: string,
) {
  const parsed = automationRuleSchema.parse(data);
  const rule = await prisma.automationRule.create({
    data: {
      name: parsed.name,
      enabled: parsed.enabled ?? true,
      trigger: parsed.trigger,
      actionType: parsed.actionType,
      config: (parsed.config ?? {}) as object,
    },
  });
  await writeAuditLog({
    actorId,
    action: "automation.create",
    entityType: "automation_rule",
    entityId: rule.id,
  });
  return rule;
}

export async function updateAutomationRule(
  id: string,
  data: Partial<z.infer<typeof automationRuleSchema>>,
  actorId?: string,
) {
  await getAutomationRule(id);
  const rule = await prisma.automationRule.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.trigger !== undefined ? { trigger: data.trigger } : {}),
      ...(data.actionType !== undefined ? { actionType: data.actionType } : {}),
      ...(data.config !== undefined ? { config: data.config as object } : {}),
    },
  });
  await writeAuditLog({
    actorId,
    action: "automation.update",
    entityType: "automation_rule",
    entityId: id,
  });
  return rule;
}

export async function deleteAutomationRule(id: string, actorId?: string) {
  await getAutomationRule(id);
  await prisma.automationRule.delete({ where: { id } });
  await writeAuditLog({
    actorId,
    action: "automation.delete",
    entityType: "automation_rule",
    entityId: id,
  });
  return { ok: true };
}

function interpolate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(payload[key] ?? ""),
  );
}

async function executeRule(
  rule: {
    id: string;
    actionType: AutomationActionType;
    config: unknown;
  },
  payload: Record<string, unknown>,
) {
  const config = (rule.config ?? {}) as Record<string, unknown>;

  switch (rule.actionType) {
    case "WEBHOOK": {
      const url = String(config.url ?? "");
      if (!url) return;
      const method = String(config.method ?? "POST").toUpperCase();
      const headers =
        config.headers && typeof config.headers === "object"
          ? (config.headers as Record<string, string>)
          : { "Content-Type": "application/json" };
      await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ payload, ruleId: rule.id }),
      }).catch(() => undefined);
      break;
    }
    case "EMAIL": {
      const to = String(config.to ?? payload.clientEmail ?? "");
      if (!to) return;
      const subject = interpolate(
        String(config.subject ?? "Automation notification"),
        payload,
      );
      await enqueueEmail({
        to,
        subject,
        template: "announcement",
        payload: {
          subject,
          body: interpolate(
            String(config.body ?? "Automation event: {{event}}"),
            payload,
          ),
        },
      }).catch(() => undefined);
      break;
    }
    case "CREATE_TICKET": {
      const clientId = String(config.clientId ?? payload.clientId ?? "");
      if (!clientId) return;
      const subject = interpolate(
        String(config.subject ?? "Automation: {{event}}"),
        payload,
      );
      const body = interpolate(
        String(config.body ?? JSON.stringify(payload, null, 2)),
        payload,
      );
      const systemUser = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
      });
      if (!systemUser) return;
      await createTicket(
        {
          clientId,
          subject,
          body,
          priority: "MEDIUM",
        },
        systemUser.id,
      ).catch(() => undefined);
      break;
    }
  }
}

/** Run all enabled rules matching a trigger. */
export async function runAutomation(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
) {
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, trigger },
  });
  for (const rule of rules) {
    await executeRule(rule, payload).catch(() => undefined);
  }
}
