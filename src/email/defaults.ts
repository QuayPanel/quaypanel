export type EmailTemplateKey =
  | "welcome"
  | "invoice"
  | "receipt"
  | "ticket_reply"
  | "cron_failure";

export type EmailTemplateDefault = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyFormat: "markdown" | "html";
  body: string;
  placeholders: string[];
};

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: "welcome",
    name: "Welcome",
    description: "Sent when a client registers a new account.",
    subject: "Welcome to {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{name}},

Welcome to **{{brand}}**.

Your account has been created. You can manage invoices, orders, and payments from your client area.

[{{appUrl}}/client]({{appUrl}}/client)`,
    placeholders: ["brand", "name", "appUrl"],
  },
  {
    key: "invoice",
    name: "Invoice",
    description: "Sent when an invoice is created or a payment reminder is due.",
    subject: "Invoice {{invoiceNumber}} from {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Invoice **{{invoiceNumber}}** is ready for payment.

**Amount due:** {{total}} ({{currency}})

Log in to your client area to pay securely:

[{{appUrl}}/client]({{appUrl}}/client)`,
    placeholders: [
      "brand",
      "clientName",
      "invoiceNumber",
      "total",
      "currency",
      "appUrl",
    ],
  },
  {
    key: "receipt",
    name: "Payment receipt",
    description: "Sent after an invoice is paid successfully.",
    subject: "Payment received for {{invoiceNumber}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

We received your payment for invoice **{{invoiceNumber}}**.

**Amount paid:** {{total}}

Thank you for your business.

[{{appUrl}}/client]({{appUrl}}/client)`,
    placeholders: ["brand", "clientName", "invoiceNumber", "total", "appUrl"],
  },
  {
    key: "ticket_reply",
    name: "Ticket reply",
    description: "Sent to the client when staff replies to a support ticket.",
    subject: "New reply on ticket {{ticketNumber}} — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

There is a new reply on ticket **{{ticketNumber}}** ({{ticketSubject}}).

{{message}}

View the ticket:

[{{appUrl}}/client/tickets]({{appUrl}}/client/tickets)`,
    placeholders: [
      "brand",
      "clientName",
      "ticketNumber",
      "ticketSubject",
      "message",
      "appUrl",
    ],
  },
  {
    key: "cron_failure",
    name: "Cron failure",
    description: "Sent to the system email when the daily cron job fails.",
    subject: "{{brand}} cron job failed",
    bodyFormat: "markdown",
    body: `The daily maintenance cron for **{{brand}}** failed.

**Error:**
{{error}}

Check Admin → Cron for details.`,
    placeholders: ["brand", "error", "appUrl"],
  },
];

export function getEmailTemplateDefault(key: string) {
  return EMAIL_TEMPLATE_DEFAULTS.find((t) => t.key === key) ?? null;
}
