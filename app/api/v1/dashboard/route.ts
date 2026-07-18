import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { prisma } from "@/src/db/client";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const [clients, products, orders, unpaidInvoices, paidInvoices, payments] =
      await Promise.all([
        prisma.client.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.invoice.count({ where: { status: "UNPAID" } }),
        prisma.invoice.count({ where: { status: "PAID" } }),
        prisma.payment.count({ where: { status: "COMPLETED" } }),
      ]);

    const revenue = await prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    });

    return jsonOk({
      clients,
      products,
      orders,
      unpaidInvoices,
      paidInvoices,
      payments,
      revenueMinor: revenue._sum.amount ?? 0,
    });
  });
}
