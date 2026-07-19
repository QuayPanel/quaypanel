import nodemailer from "nodemailer";
import { env } from "@/src/core/env";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";
import type { EmailJobData } from "@/src/jobs/email";
import { getSettingsMap } from "@/src/domains/settings/service";
import {
  htmlToPlainText,
  renderEmailTemplate,
} from "@/src/email/render-template";

async function getTransporter() {
  const settings = await getSettingsMap();
  const host = String(settings["smtp.host"] || env.SMTP_HOST || "");
  const port = Number(settings["smtp.port"] || env.SMTP_PORT || 587);
  const user = String(settings["smtp.user"] || env.SMTP_USER || "");
  const pass = String(settings["smtp.pass"] || env.SMTP_PASS || "");
  const encryption = String(settings["smtp.encryption"] || "tls");
  const fromAddr = String(settings["smtp.from"] || env.SMTP_FROM);
  const fromName = String(
    settings["smtp.fromName"] || settings["brand.name"] || "QuayPanel",
  );
  const from = fromName ? `"${fromName}" <${fromAddr}>` : fromAddr;

  if (!host) {
    return { transporter: null, from, settings };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: encryption === "ssl" || port === 465,
    requireTLS: encryption === "tls",
    auth: user ? { user, pass } : undefined,
  });

  return { transporter, from, settings };
}

export async function sendTemplatedEmail(data: EmailJobData) {
  const { transporter, from, settings } = await getTransporter();

  const rendered = await renderEmailTemplate({
    key: data.template,
    settings,
    payload: data.payload,
  });

  if (!rendered.enabled) {
    logger.info(
      { to: data.to, template: data.template },
      "Email template disabled — skipped",
    );
    await prisma.emailLog
      .create({
        data: {
          to: data.to,
          from,
          subject: rendered.subject,
          status: "logged",
          templateKey: rendered.templateKey,
          html: rendered.html,
          error: "Template disabled",
        },
      })
      .catch(() => undefined);
    return;
  }

  const text = htmlToPlainText(rendered.html);

  if (!transporter) {
    logger.info(
      { to: data.to, subject: rendered.subject, template: data.template },
      "SMTP not configured — email logged only",
    );
    await prisma.emailLog
      .create({
        data: {
          to: data.to,
          from,
          subject: rendered.subject,
          status: "logged",
          templateKey: rendered.templateKey,
          html: rendered.html,
        },
      })
      .catch(() => undefined);
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: data.to,
      subject: rendered.subject,
      html: rendered.html,
      text,
    });
    await prisma.emailLog.create({
      data: {
        to: data.to,
        from,
        subject: rendered.subject,
        status: "sent",
        templateKey: rendered.templateKey,
        html: rendered.html,
      },
    });
    logger.info(
      { to: data.to, subject: rendered.subject, template: data.template },
      "Email sent",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await prisma.emailLog
      .create({
        data: {
          to: data.to,
          from,
          subject: rendered.subject,
          status: "failed",
          templateKey: rendered.templateKey,
          html: rendered.html,
          error: message,
        },
      })
      .catch(() => undefined);
    throw err;
  }
}
