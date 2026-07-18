import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { env } from "@/src/core/env";
import { logger } from "@/src/core/logger";
import { prisma } from "@/src/db/client";
import { InvoiceEmail } from "@/src/email/templates/invoice";
import { ReceiptEmail } from "@/src/email/templates/receipt";
import { WelcomeEmail } from "@/src/email/templates/welcome";
import type { EmailJobData } from "@/src/jobs/email";
import { getSettingsMap } from "@/src/domains/settings/service";

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

function wrapHtml(html: string, settings: Record<string, unknown>, brand: string) {
  const header = String(settings["mail.headerHtml"] || "").replaceAll(
    "{{brand}}",
    brand,
  );
  const footer = String(settings["mail.footerHtml"] || "").replaceAll(
    "{{brand}}",
    brand,
  );
  const css = String(settings["mail.css"] || "");
  return `<!doctype html><html><head><style>${css}</style></head><body>${header}${html}${footer}</body></html>`;
}

export async function sendTemplatedEmail(data: EmailJobData) {
  const { transporter, from, settings } = await getTransporter();
  const brand = String(settings["brand.name"] || env.DEFAULT_BRAND_NAME);

  let html: string;
  switch (data.template) {
    case "invoice":
      html = await render(
        InvoiceEmail({
          brandName: brand,
          clientName: String(data.payload.clientName ?? ""),
          invoiceNumber: String(data.payload.invoiceNumber ?? ""),
          total: String(data.payload.total ?? ""),
          currency: String(data.payload.currency ?? "USD"),
        }),
      );
      break;
    case "receipt":
      html = await render(
        ReceiptEmail({
          brandName: brand,
          clientName: String(data.payload.clientName ?? ""),
          invoiceNumber: String(data.payload.invoiceNumber ?? ""),
          total: String(data.payload.total ?? ""),
        }),
      );
      break;
    case "welcome":
      html = await render(
        WelcomeEmail({
          brandName: brand,
          name: String(data.payload.name ?? ""),
        }),
      );
      break;
  }

  html = wrapHtml(html, settings, brand);

  if (!transporter) {
    logger.info(
      { to: data.to, subject: data.subject, template: data.template },
      "SMTP not configured — email logged only",
    );
    await prisma.emailLog
      .create({
        data: {
          to: data.to,
          subject: data.subject,
          status: "logged",
        },
      })
      .catch(() => undefined);
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: data.to,
      subject: data.subject,
      html,
    });
    await prisma.emailLog.create({
      data: { to: data.to, subject: data.subject, status: "sent" },
    });
    logger.info({ to: data.to, subject: data.subject }, "Email sent");
  } catch (err) {
    await prisma.emailLog
      .create({
        data: { to: data.to, subject: data.subject, status: "failed" },
      })
      .catch(() => undefined);
    throw err;
  }
}
