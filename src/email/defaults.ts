export type EmailTemplateKey =
  | "welcome"
  | "invoice"
  | "receipt"
  | "ticket_reply"
  | "cron_failure"
  | "announcement"
  | "overdue"
  | "suspension_warning"
  | "termination_warning"
  | "service_ready"
  | "cancellation_confirm"
  | "affiliate_payout";

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
  {
    key: "announcement",
    name: "Announcement / broadcast",
    description: "Used for mass mail and broadcast messages.",
    subject: "{{subject}}",
    bodyFormat: "html",
    body: `{{body}}`,
    placeholders: ["brand", "subject", "body", "appUrl"],
  },
  {
    key: "overdue",
    name: "Invoice overdue",
    description: "Sent when an invoice is past its due date.",
    subject: "Overdue: invoice {{invoiceNumber}} — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Invoice **{{invoiceNumber}}** is now **overdue**.

**Amount due:** {{total}} ({{currency}})

Please pay as soon as possible to avoid service interruption:

[{{appUrl}}/client/invoices]({{appUrl}}/client/invoices)`,
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
    key: "suspension_warning",
    name: "Suspension warning",
    description: "Sent before an overdue service is suspended.",
    subject: "Action required: service suspension pending — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Your service **{{serviceName}}** has an unpaid invoice (**{{invoiceNumber}}**).

If payment is not received, the service may be **suspended** soon.

**Amount due:** {{total}} ({{currency}})

[Pay now]({{appUrl}}/client/invoices)`,
    placeholders: [
      "brand",
      "clientName",
      "serviceName",
      "invoiceNumber",
      "total",
      "currency",
      "appUrl",
    ],
  },
  {
    key: "termination_warning",
    name: "Termination notice",
    description: "Sent when an overdue service is terminated for non-payment.",
    subject: "Service terminated — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Your service **{{serviceName}}** has been **terminated** due to non-payment on invoice **{{invoiceNumber}}**.

If you believe this is an error, please open a support ticket.

[{{appUrl}}/client/tickets]({{appUrl}}/client/tickets)`,
    placeholders: [
      "brand",
      "clientName",
      "serviceName",
      "invoiceNumber",
      "appUrl",
    ],
  },
  {
    key: "service_ready",
    name: "Service ready",
    description: "Sent when provisioning completes and the service is active.",
    subject: "Your service is ready — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Your service **{{serviceName}}** is now **active** and ready to use.

{{hostname}}

Manage it from your client area:

[{{appUrl}}/client/services]({{appUrl}}/client/services)`,
    placeholders: [
      "brand",
      "clientName",
      "serviceName",
      "hostname",
      "appUrl",
    ],
  },
  {
    key: "cancellation_confirm",
    name: "Cancellation confirmation",
    description: "Sent when a client requests service cancellation.",
    subject: "Cancellation confirmed — {{serviceName}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

We received your cancellation request for **{{serviceName}}**.

**Effective:** {{cancelAt}}

{{reason}}

You can manage services in your client area:

[{{appUrl}}/client/services]({{appUrl}}/client/services)`,
    placeholders: [
      "brand",
      "clientName",
      "serviceName",
      "cancelAt",
      "reason",
      "appUrl",
    ],
  },
  {
    key: "affiliate_payout",
    name: "Affiliate payout",
    description: "Sent when an affiliate payout is processed.",
    subject: "Affiliate payout processed — {{brand}}",
    bodyFormat: "markdown",
    body: `Hi {{clientName}},

Your affiliate payout of **{{amount}}** has been processed.

**Status:** {{status}}

{{note}}

[{{appUrl}}/client/affiliates]({{appUrl}}/client/affiliates)`,
    placeholders: [
      "brand",
      "clientName",
      "amount",
      "status",
      "note",
      "appUrl",
    ],
  },
];

export function getEmailTemplateDefault(key: string) {
  return EMAIL_TEMPLATE_DEFAULTS.find((t) => t.key === key) ?? null;
}
