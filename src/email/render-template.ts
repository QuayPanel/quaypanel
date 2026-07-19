import { marked } from "marked";
import { prisma } from "@/src/db/client";
import { NotFoundError } from "@/src/core/errors";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  getEmailTemplateDefault,
  type EmailTemplateKey,
} from "@/src/email/defaults";
import {
  applyPlaceholders,
  buildEmailContext,
} from "@/src/email/placeholders";

marked.setOptions({ gfm: true, breaks: true });

export async function ensureEmailTemplatesSeeded() {
  for (const def of EMAIL_TEMPLATE_DEFAULTS) {
    await prisma.emailTemplate.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        subject: def.subject,
        bodyFormat: def.bodyFormat,
        body: def.body,
        enabled: true,
      },
      update: {},
    });
  }
}

export async function getEmailTemplateByKey(key: string) {
  await ensureEmailTemplatesSeeded();
  const row = await prisma.emailTemplate.findUnique({ where: { key } });
  if (row) return row;
  const fallback = getEmailTemplateDefault(key);
  if (!fallback) throw new NotFoundError(`Email template not found: ${key}`);
  return {
    id: "",
    key: fallback.key,
    name: fallback.name,
    description: fallback.description,
    subject: fallback.subject,
    bodyFormat: fallback.bodyFormat,
    body: fallback.body,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function markdownToHtml(markdown: string): Promise<string> {
  return marked.parse(markdown, { async: true });
}

export function wrapEmailHtml(
  html: string,
  settings: Record<string, unknown>,
  brand: string,
) {
  const header = applyPlaceholders(
    String(settings["mail.headerHtml"] || ""),
    { brand },
  );
  const footer = applyPlaceholders(
    String(settings["mail.footerHtml"] || ""),
    { brand },
  );
  const css = String(settings["mail.css"] || "");
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${header}${html}${footer}</body></html>`;
}

export async function renderEmailTemplate(input: {
  key: EmailTemplateKey | string;
  settings: Record<string, unknown>;
  payload: Record<string, unknown>;
  subjectOverride?: string;
}): Promise<{ subject: string; html: string; templateKey: string; enabled: boolean }> {
  const template = await getEmailTemplateByKey(input.key);
  const ctx = buildEmailContext(input.settings, input.payload);
  const brand = String(ctx.brand);

  const subject = applyPlaceholders(
    input.subjectOverride || template.subject,
    ctx,
  );
  let body = applyPlaceholders(template.body, ctx);
  if (template.bodyFormat === "markdown") {
    body = await markdownToHtml(body);
  }

  const html = wrapEmailHtml(body, input.settings, brand);
  return {
    subject,
    html,
    templateKey: template.key,
    enabled: template.enabled,
  };
}

/** Strip tags for a rough multipart text alternative. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
