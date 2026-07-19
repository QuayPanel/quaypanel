import { withApi, jsonOk } from "@/src/core/api";
import { requireStaff } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { getSetting } from "@/src/domains/settings/service";

export async function GET(request: Request) {
  return withApi(request, async ({ auth }) => {
    requireStaff(auth);
    const [
      clients,
      products,
      orders,
      unpaidInvoices,
      paidInvoices,
      payments,
      categories,
      productsWithPlans,
      knowledgeArticles,
      enabledGateways,
      brandName,
      brandLogo,
      revenue,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.invoice.count({ where: { status: "UNPAID" } }),
      prisma.invoice.count({ where: { status: "PAID" } }),
      prisma.payment.count({ where: { status: "COMPLETED" } }),
      prisma.category.count(),
      prisma.product.count({ where: { plans: { some: {} } } }),
      prisma.knowledgeArticle.count(),
      prisma.gatewayConfig.count({ where: { enabled: true } }),
      getSetting("brand.name", "QuayPanel"),
      getSetting("brand.logoUrl", ""),
      prisma.payment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

    const name = String(brandName ?? "").trim();
    const logo = String(brandLogo ?? "").trim();
    const brandConfigured =
      logo.length > 0 || (name.length > 0 && name !== "QuayPanel");

    return jsonOk({
      clients,
      products,
      orders,
      unpaidInvoices,
      paidInvoices,
      payments,
      revenueMinor: revenue._sum.amount ?? 0,
      setup: {
        brandConfigured,
        paymentGatewayEnabled: enabledGateways > 0,
        hasCategory: categories > 0,
        hasProductWithPlan: productsWithPlans > 0,
        hasKnowledgeArticle: knowledgeArticles > 0,
      },
    });
  });
}
