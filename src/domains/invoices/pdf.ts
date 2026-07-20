import PDFDocument from "pdfkit";
import { getSetting } from "@/src/domains/settings/service";
import { formatMoney } from "@/src/core/utils";
import type { getInvoice } from "@/src/domains/invoices/service";

type InvoiceForPdf = Awaited<ReturnType<typeof getInvoice>>;

export async function buildInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  const brand = String(await getSetting("brand.name", "QuayPanel"));
  const client = invoice.snapshot
    ? (invoice.snapshot as Record<string, string>)
    : invoice.client;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(brand, { continued: false });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Invoice ${invoice.number}`);
    doc.fontSize(10).fillColor("#666");
    doc.text(`Status: ${invoice.status}`);
    if (invoice.dueAt) {
      doc.text(`Due: ${invoice.dueAt.toLocaleDateString()}`);
    }
    doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(11).text("Bill to:", { underline: true });
    doc.text(String(client.name ?? invoice.client.name));
    if (client.company) doc.text(String(client.company));
    doc.text(String(client.email ?? invoice.client.email));
    const addr = [
      client.address1,
      client.address2,
      [client.city, client.state, client.postalCode].filter(Boolean).join(", "),
      client.country,
    ]
      .filter(Boolean)
      .join("\n");
    if (addr) doc.text(addr);
    doc.moveDown();

    doc.fontSize(11).text("Line items", { underline: true });
    doc.moveDown(0.5);
    for (const item of invoice.items) {
      doc
        .fontSize(10)
        .text(
          `${item.description}  ×${item.quantity}  —  ${formatMoney(item.total, invoice.currency)}`,
        );
    }
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`);
    if (invoice.discountMinor > 0) {
      doc.text(
        `Discount: -${formatMoney(invoice.discountMinor, invoice.currency)}`,
      );
    }
    if (invoice.taxMinor > 0) {
      doc.text(`Tax: ${formatMoney(invoice.taxMinor, invoice.currency)}`);
    }
    doc.fontSize(12).text(`Total: ${formatMoney(invoice.total, invoice.currency)}`, {
      underline: true,
    });

    doc.end();
  });
}
