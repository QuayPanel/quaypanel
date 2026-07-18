import { loadBuiltInGateways, getPaymentGateway } from "@/src/plugins/registry";
import { settleWebhookPayment } from "@/src/domains/payments/service";
import { jsonOk, jsonError } from "@/src/core/api";
import { logger } from "@/src/core/logger";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    await loadBuiltInGateways();
    const gateway = getPaymentGateway("paypal");
    const result = await gateway.handleWebhook(request, rawBody);

    if (!result.handled || result.status !== "completed") {
      return jsonOk({ received: true, handled: result.handled });
    }

    await settleWebhookPayment({
      gatewayId: "paypal",
      externalEventId: result.externalEventId,
      paymentExternalId: result.paymentExternalId,
      invoiceId: result.invoiceId,
      amount: result.amount,
      payload: JSON.parse(rawBody),
    });

    return jsonOk({ received: true, handled: true });
  } catch (error) {
    logger.error({ err: error }, "PayPal webhook failed");
    return jsonError(error);
  }
}
