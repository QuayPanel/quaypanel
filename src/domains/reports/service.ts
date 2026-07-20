import { prisma } from "@/src/db/client";
import { ValidationError } from "@/src/core/errors";

export type ReportSummary = {
  from: string;
  to: string;
  mrrEstimateMinor: number;
  ordersCount: number;
  revenueMinor: number;
  taxMinor: number;
  byGateway: Array<{ gatewayId: string; count: number; amountMinor: number }>;
};

function parseRange(from?: string | null, to?: string | null) {
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new ValidationError("Invalid date range");
  }
  if (fromDate > toDate) {
    throw new ValidationError("from must be before to");
  }
  return { fromDate, toDate };
}

export async function getReportSummary(params: {
  from?: string | null;
  to?: string | null;
}): Promise<ReportSummary> {
  const { fromDate, toDate } = parseRange(params.from, params.to);

  const [activeServices, ordersCount, paidPayments, paymentsByGateway] =
    await Promise.all([
      prisma.service.findMany({
        where: { status: "ACTIVE", plan: { type: "RECURRING" } },
        include: { plan: true },
      }),
      prisma.order.count({
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: fromDate, lte: toDate },
        },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["gatewayId"],
        where: {
          status: "COMPLETED",
          createdAt: { gte: fromDate, lte: toDate },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

  const mrrEstimateMinor = activeServices.reduce(
    (sum, service) => sum + service.plan.price * service.quantity,
    0,
  );

  const invoicesInRange = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: fromDate, lte: toDate },
    },
    select: { taxMinor: true },
  });
  const taxMinor = invoicesInRange.reduce((sum, inv) => sum + inv.taxMinor, 0);

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    mrrEstimateMinor,
    ordersCount,
    revenueMinor: paidPayments._sum.amount ?? 0,
    taxMinor,
    byGateway: paymentsByGateway.map((row) => ({
      gatewayId: row.gatewayId,
      count: row._count._all,
      amountMinor: row._sum.amount ?? 0,
    })),
  };
}

function csvEscape(value: unknown) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function exportClientsCsv() {
  const clients = await prisma.client.findMany({ orderBy: { number: "asc" } });
  return toCsv(
    [
      "number",
      "name",
      "email",
      "company",
      "phone",
      "country",
      "creditBalanceMinor",
      "createdAt",
    ],
    clients.map((c) => ({
      number: c.number,
      name: c.name,
      email: c.email,
      company: c.company ?? "",
      phone: c.phone ?? "",
      country: c.country ?? "",
      creditBalanceMinor: c.creditBalanceMinor,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}

export async function exportInvoicesCsv() {
  const invoices = await prisma.invoice.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return toCsv(
    [
      "number",
      "clientEmail",
      "status",
      "currency",
      "subtotal",
      "taxMinor",
      "total",
      "paidAt",
      "createdAt",
    ],
    invoices.map((inv) => ({
      number: inv.number,
      clientEmail: inv.client.email,
      status: inv.status,
      currency: inv.currency,
      subtotal: inv.subtotal,
      taxMinor: inv.taxMinor,
      total: inv.total,
      paidAt: inv.paidAt?.toISOString() ?? "",
      createdAt: inv.createdAt.toISOString(),
    })),
  );
}

export async function exportPaymentsCsv() {
  const payments = await prisma.payment.findMany({
    include: { invoice: true },
    orderBy: { createdAt: "desc" },
  });
  return toCsv(
    [
      "number",
      "invoiceNumber",
      "gatewayId",
      "status",
      "amount",
      "currency",
      "createdAt",
    ],
    payments.map((p) => ({
      number: p.number,
      invoiceNumber: p.invoice.number,
      gatewayId: p.gatewayId,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      createdAt: p.createdAt.toISOString(),
    })),
  );
}

export async function exportServicesCsv() {
  const services = await prisma.service.findMany({
    include: { client: true, plan: { include: { product: true } } },
    orderBy: { number: "asc" },
  });
  return toCsv(
    [
      "number",
      "clientEmail",
      "product",
      "plan",
      "status",
      "nextDueAt",
      "createdAt",
    ],
    services.map((s) => ({
      number: s.number,
      clientEmail: s.client.email,
      product: s.plan.product.name,
      plan: s.plan.name,
      status: s.status,
      nextDueAt: s.nextDueAt?.toISOString() ?? "",
      createdAt: s.createdAt.toISOString(),
    })),
  );
}
