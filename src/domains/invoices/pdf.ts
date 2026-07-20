import { readFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { getSetting } from "@/src/domains/settings/service";
import { env } from "@/src/core/env";
import type { getInvoice } from "@/src/domains/invoices/service";

type InvoiceForPdf = Awaited<ReturnType<typeof getInvoice>>;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_RIGHT = PAGE_W - MARGIN;
const MUTED = rgb(0.35, 0.35, 0.35);
const LINE = rgb(0.82, 0.82, 0.82);
const HEADER_BG = rgb(0.96, 0.96, 0.97);

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

function formatMoneyPdf(amountMinor: number, currency = "USD") {
  const amount = (Math.abs(amountMinor) / 100).toFixed(2);
  const sign = amountMinor < 0 ? "-" : "";
  if (currency.toUpperCase() === "USD") return `${sign}$${amount}`;
  return `${sign}${safeText(currency)} ${amount}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Prefer product name when description is "Product - Plan". */
function productLabel(description: string) {
  const text = safeText(description);
  const sep = text.indexOf(" - ");
  if (sep > 0) return text.slice(0, sep);
  return text;
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

function isPng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function loadLogoBytes(logoUrl: string): Promise<Uint8Array | null> {
  const raw = logoUrl.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", raw.replace(/^\//, ""));
      return new Uint8Array(await readFile(filePath));
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const res = await fetch(raw);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    if (raw.startsWith("/")) {
      const absolute = new URL(raw, env.APP_URL).toString();
      const res = await fetch(absolute);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    return null;
  }
  return null;
}

async function embedLogo(
  pdf: PDFDocument,
  logoUrl: string,
): Promise<PDFImage | null> {
  const bytes = await loadLogoBytes(logoUrl);
  if (!bytes) return null;
  try {
    if (isPng(bytes)) return await pdf.embedPng(bytes);
    if (isJpg(bytes)) return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
  return null;
}

export async function buildInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  const brand = safeText(await getSetting("brand.name", "QuayPanel"), "QuayPanel");
  const billToText = safeText(await getSetting("invoice.billTo", "")).trim();
  const logoUrl = String(await getSetting("brand.logoUrl", "")).trim();
  const client = snapshotClient(invoice);
  const currency = invoice.currency || "USD";

  const pdf = await PDFDocument.create();
  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawText = (
    text: string,
    x: number,
    atY: number,
    opts?: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    },
  ) => {
    const size = opts?.size ?? 10;
    const f: PDFFont = opts?.bold ? fontBold : font;
    let t = safeText(text);
    if (opts?.maxWidth) {
      while (t.length > 1 && f.widthOfTextAtSize(t, size) > opts.maxWidth) {
        t = t.slice(0, -1);
      }
      if (t !== safeText(text) && t.length > 3) t = `${t.slice(0, -3)}...`;
    }
    page.drawText(t, {
      x,
      y: atY,
      size,
      font: f,
      color: opts?.color ?? rgb(0, 0, 0),
    });
  };

  const drawRight = (
    text: string,
    xRight: number,
    atY: number,
    opts?: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
    },
  ) => {
    const size = opts?.size ?? 10;
    const f: PDFFont = opts?.bold ? fontBold : font;
    const t = safeText(text);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, {
      x: xRight - w,
      y: atY,
      size,
      font: f,
      color: opts?.color ?? rgb(0, 0, 0),
    });
  };

  // --- Header: logo left, INVOICE + company + bill-to text right ---
  const logo = await embedLogo(pdf, logoUrl);
  let headerBottom = y;

  if (logo) {
    const maxW = 150;
    const maxH = 56;
    const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, {
      x: MARGIN,
      y: y - h,
      width: w,
      height: h,
    });
    headerBottom = Math.min(headerBottom, y - h);
  } else {
    drawText(brand, MARGIN, y - 18, { bold: true, size: 16 });
    headerBottom = y - 28;
  }

  let rightY = y - 4;
  drawRight("INVOICE", CONTENT_RIGHT, rightY, { bold: true, size: 22 });
  rightY -= 26;
  drawRight(brand, CONTENT_RIGHT, rightY, { bold: true, size: 11 });
  rightY -= 14;
  if (billToText) {
    for (const row of billToText.split(/\r?\n/).filter(Boolean).slice(0, 6)) {
      drawRight(row, CONTENT_RIGHT, rightY, { size: 9, color: MUTED });
      rightY -= 12;
    }
  }
  headerBottom = Math.min(headerBottom, rightY);

  y = headerBottom - 28;

  // Divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: CONTENT_RIGHT, y },
    thickness: 1,
    color: LINE,
  });
  y -= 28;

  // --- Bill to (left) + invoice meta (right) ---
  const metaX = 340;
  const billStartY = y;

  drawText("Bill to", MARGIN, y, { bold: true, size: 10, color: MUTED });
  y -= 16;
  drawText(client.name, MARGIN, y, { bold: true, size: 11, maxWidth: 260 });
  y -= 14;
  if (client.company) {
    drawText(client.company, MARGIN, y, { size: 10, maxWidth: 260 });
    y -= 13;
  }
  drawText(client.email, MARGIN, y, { size: 10, maxWidth: 260, color: MUTED });
  y -= 13;
  for (const row of [
    client.address1,
    client.address2,
    [client.city, client.state, client.postalCode].filter(Boolean).join(", "),
    client.country,
  ].filter(Boolean)) {
    drawText(row, MARGIN, y, { size: 10, maxWidth: 260 });
    y -= 13;
  }
  const billEndY = y;

  let metaY = billStartY;
  const metaRows: Array<[string, string]> = [
    ["Invoice No.", safeText(invoice.number)],
    ["Issue Date", formatDate(invoice.createdAt)],
    ["Due Date", formatDate(invoice.dueAt)],
  ];
  for (const [label, value] of metaRows) {
    drawText(label, metaX, metaY, { size: 9, color: MUTED });
    drawRight(value, CONTENT_RIGHT, metaY, { bold: true, size: 10 });
    metaY -= 16;
  }

  y = Math.min(billEndY, metaY) - 24;

  // --- Line items table ---
  const colProduct = MARGIN;
  const colQty = 340;
  const colUnit = 420;
  const colAmount = CONTENT_RIGHT;
  const rowH = 22;

  ensureSpace(rowH + 40);
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: CONTENT_RIGHT - MARGIN,
    height: rowH,
    color: HEADER_BG,
  });

  const headerY = y;
  drawText("Product", colProduct + 6, headerY, { bold: true, size: 9, color: MUTED });
  drawRight("Qty", colQty, headerY, { bold: true, size: 9, color: MUTED });
  drawRight("Unit Price", colUnit, headerY, { bold: true, size: 9, color: MUTED });
  drawRight("Amount", colAmount - 6, headerY, {
    bold: true,
    size: 9,
    color: MUTED,
  });
  y -= rowH;

  for (const item of invoice.items) {
    ensureSpace(rowH + 10);
    const product = productLabel(item.description);
    drawText(product, colProduct + 6, y, { size: 10, maxWidth: 250 });
    drawRight(String(item.quantity), colQty, y, { size: 10 });
    drawRight(formatMoneyPdf(item.unitPrice, currency), colUnit, y, {
      size: 10,
    });
    drawRight(formatMoneyPdf(item.total, currency), colAmount - 6, y, {
      size: 10,
    });
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: CONTENT_RIGHT, y },
      thickness: 0.5,
      color: LINE,
    });
    y -= rowH - 4;
  }

  y -= 16;
  ensureSpace(60);

  if (invoice.discountMinor > 0) {
    drawText("Discount", metaX, y, { size: 10, color: MUTED });
    drawRight(
      `-${formatMoneyPdf(invoice.discountMinor, currency)}`,
      CONTENT_RIGHT,
      y,
      { size: 10 },
    );
    y -= 16;
  }
  if (invoice.taxMinor > 0) {
    drawText("Tax", metaX, y, { size: 10, color: MUTED });
    drawRight(formatMoneyPdf(invoice.taxMinor, currency), CONTENT_RIGHT, y, {
      size: 10,
    });
    y -= 16;
  }

  page.drawLine({
    start: { x: metaX, y: y + 8 },
    end: { x: CONTENT_RIGHT, y: y + 8 },
    thickness: 1,
    color: LINE,
  });

  drawText("Total Due", metaX, y - 4, { bold: true, size: 12 });
  drawRight(formatMoneyPdf(invoice.total, currency), CONTENT_RIGHT, y - 4, {
    bold: true,
    size: 14,
  });

  if (invoice.isProforma) {
    y -= 36;
    ensureSpace(20);
    drawText("PROFORMA - not a tax invoice", MARGIN, y, {
      bold: true,
      size: 10,
      color: rgb(0.6, 0.2, 0.1),
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
