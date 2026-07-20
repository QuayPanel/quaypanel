import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getSetting } from "@/src/domains/settings/service";
import type { getInvoice } from "@/src/domains/invoices/service";

type InvoiceForPdf = Awaited<ReturnType<typeof getInvoice>>;

/** Map common Unicode to ASCII so Helvetica/WinAnsi does not show "?". */
function safeText(input: unknown, fallback = "") {
  const raw = input == null ? fallback : String(input);
  return raw
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2022\u00B7\u2024]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(R)")
    .replace(/\u2122/g, "(TM)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

/** ASCII money for PDF fonts (avoids locale currency glyphs). */
function formatMoneyPdf(amountMinor: number, currency = "USD") {
  const amount = (Math.abs(amountMinor) / 100).toFixed(2);
  const sign = amountMinor < 0 ? "-" : "";
  if (currency.toUpperCase() === "USD") return `${sign}$${amount}`;
  return `${sign}${safeText(currency)} ${amount}`;
}

function snapshotClient(invoice: InvoiceForPdf) {
  const snap =
    invoice.snapshot && typeof invoice.snapshot === "object"
      ? (invoice.snapshot as Record<string, unknown>)
      : null;
  return {
    name: safeText(snap?.name ?? invoice.client.name),
    email: safeText(snap?.email ?? invoice.client.email),
    company: safeText(snap?.company ?? invoice.client.company ?? ""),
    address1: safeText(snap?.address1 ?? invoice.client.address1 ?? ""),
    address2: safeText(snap?.address2 ?? invoice.client.address2 ?? ""),
    city: safeText(snap?.city ?? invoice.client.city ?? ""),
    state: safeText(snap?.state ?? invoice.client.state ?? ""),
    postalCode: safeText(snap?.postalCode ?? invoice.client.postalCode ?? ""),
    country: safeText(snap?.country ?? invoice.client.country ?? ""),
  };
}

export async function buildInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  const brand = safeText(await getSetting("brand.name", "QuayPanel"), "QuayPanel");
  // Seller / company block on the PDF (settings label: From / company details).
  const fromText = safeText(await getSetting("invoice.billTo", "")).trim();
  const client = snapshotClient(invoice);

  const pdf = await PDFDocument.create();
  let page: PDFPage = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const left = 50;

  const ensureSpace = (needed: number) => {
    if (y - needed < 50) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
  };

  const line = (
    text: string,
    opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> },
  ) => {
    const size = opts?.size ?? 11;
    ensureSpace(size + 8);
    const f: PDFFont = opts?.bold ? fontBold : font;
    page.drawText(safeText(text).slice(0, 110), {
      x: left,
      y,
      size,
      font: f,
      color: opts?.color ?? rgb(0, 0, 0),
    });
    y -= size + 6;
  };

  line(brand, { bold: true, size: 18 });
  y -= 4;
  line(`Invoice ${safeText(invoice.number)}`, { bold: true, size: 14 });
  line(`Status: ${invoice.status}`, { size: 10, color: rgb(0.4, 0.4, 0.4) });
  if (invoice.dueAt) {
    line(`Due: ${new Date(invoice.dueAt).toLocaleDateString()}`, {
      size: 10,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  line(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, {
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 8;

  if (fromText) {
    line("From:", { bold: true, size: 11 });
    for (const row of fromText.split(/\r?\n/).filter(Boolean).slice(0, 8)) {
      line(row, { size: 10 });
    }
    y -= 6;
  }

  line("Bill to:", { bold: true, size: 11 });
  line(client.name, { size: 10 });
  if (client.company) line(client.company, { size: 10 });
  line(client.email, { size: 10 });
  for (const row of [
    client.address1,
    client.address2,
    [client.city, client.state, client.postalCode].filter(Boolean).join(", "),
    client.country,
  ].filter(Boolean)) {
    line(row, { size: 10 });
  }
  y -= 10;

  line("Line items", { bold: true, size: 11 });
  y -= 2;
  for (const item of invoice.items) {
    const row = `${safeText(item.description)}  x${item.quantity}  -  ${formatMoneyPdf(item.total, invoice.currency)}`;
    for (const chunk of row.match(/.{1,95}/g) ?? [row]) {
      line(chunk, { size: 10 });
    }
  }
  y -= 8;

  line(`Subtotal: ${formatMoneyPdf(invoice.subtotal, invoice.currency)}`, {
    size: 11,
  });
  if (invoice.discountMinor > 0) {
    line(
      `Discount: -${formatMoneyPdf(invoice.discountMinor, invoice.currency)}`,
      { size: 11 },
    );
  }
  if (invoice.taxMinor > 0) {
    line(`Tax: ${formatMoneyPdf(invoice.taxMinor, invoice.currency)}`, {
      size: 11,
    });
  }
  line(`Total: ${formatMoneyPdf(invoice.total, invoice.currency)}`, {
    bold: true,
    size: 13,
  });

  if (invoice.isProforma) {
    y -= 12;
    line("PROFORMA - not a tax invoice", {
      bold: true,
      size: 10,
      color: rgb(0.6, 0.2, 0.1),
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
