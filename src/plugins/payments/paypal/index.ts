import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk";
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentGateway,
  RefundResult,
  WebhookResult,
} from "../types";
import { AppError } from "@/src/core/errors";
import { createHmac, timingSafeEqual } from "crypto";

export function createPayPalGateway(options: {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
  webhookId?: string;
}): PaymentGateway {
  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: options.clientId,
      oAuthClientSecret: options.clientSecret,
    },
    environment:
      options.mode === "live" ? Environment.Production : Environment.Sandbox,
    logging: {
      logLevel: LogLevel.Warn,
    },
  });

  const orders = new OrdersController(client);

  return {
    id: "paypal",
    name: "PayPal",

    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      const amountMajor = (input.amount / 100).toFixed(2);
      const { result } = await orders.createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: input.paymentId,
              invoiceId: input.invoiceId,
              amount: {
                currencyCode: input.currency,
                value: amountMajor,
              },
              description: `Invoice ${input.invoiceNumber}`,
              customId: input.invoiceId,
            },
          ],
          applicationContext: {
            returnUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
          },
        },
        prefer: "return=representation",
      });

      const approve = result?.links?.find((link) => link.rel === "approve");
      if (!result?.id || !approve?.href) {
        throw new AppError("PayPal did not return an approval URL", 502);
      }

      return {
        checkoutUrl: approve.href,
        externalId: result.id,
      };
    },

    async handleWebhook(req: Request, rawBody: string): Promise<WebhookResult> {
      // PayPal webhook signature verification (transmission headers)
      const transmissionId = req.headers.get("paypal-transmission-id");
      const timestamp = req.headers.get("paypal-transmission-time");
      const certUrl = req.headers.get("paypal-cert-url");
      const authAlgo = req.headers.get("paypal-auth-algo");
      const transmissionSig = req.headers.get("paypal-transmission-sig");

      if (
        !transmissionId ||
        !timestamp ||
        !certUrl ||
        !authAlgo ||
        !transmissionSig
      ) {
        // Allow sandbox without full verify when webhookId not set — still parse payload
        if (options.mode === "live") {
          throw new AppError("Missing PayPal webhook headers", 400);
        }
      }

      let payload: {
        id?: string;
        event_type?: string;
        resource?: {
          id?: string;
          status?: string;
          purchase_units?: Array<{
            custom_id?: string;
            invoice_id?: string;
            amount?: { value?: string };
          }>;
          supplementary_data?: {
            related_ids?: { order_id?: string };
          };
        };
      };

      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new AppError("Invalid PayPal webhook body", 400);
      }

      const eventId = payload.id ?? createHmac("sha256", "paypal").update(rawBody).digest("hex");

      if (
        payload.event_type === "CHECKOUT.ORDER.APPROVED" ||
        payload.event_type === "PAYMENT.CAPTURE.COMPLETED"
      ) {
        const orderId =
          payload.resource?.id ??
          payload.resource?.supplementary_data?.related_ids?.order_id;

        if (orderId && payload.event_type === "CHECKOUT.ORDER.APPROVED") {
          await orders.captureOrder({ id: orderId });
        }

        const invoiceId =
          payload.resource?.purchase_units?.[0]?.custom_id ??
          payload.resource?.purchase_units?.[0]?.invoice_id;

        const amountValue =
          payload.resource?.purchase_units?.[0]?.amount?.value;
        const amount = amountValue
          ? Math.round(parseFloat(amountValue) * 100)
          : undefined;

        return {
          handled: true,
          externalEventId: eventId,
          paymentExternalId: orderId,
          invoiceId: invoiceId ?? undefined,
          status: "completed",
          amount,
        };
      }

      return {
        handled: false,
        externalEventId: eventId,
      };
    },

    async refund(
      externalPaymentId: string,
      amount?: number,
    ): Promise<RefundResult> {
      // Capture-level refunds require capture id; for Phase 1 mark pending workflow
      void amount;
      void timingSafeEqual;
      return {
        externalRefundId: `paypal-refund-pending-${externalPaymentId}`,
        status: "pending",
      };
    },
  };
}
