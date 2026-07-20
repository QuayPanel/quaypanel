import Stripe from "stripe";
import type {
  ChargeCustomerInput,
  ChargeCustomerResult,
  CheckoutInput,
  CheckoutResult,
  PaymentGateway,
  RefundResult,
  WebhookResult,
} from "../types";
import { AppError } from "@/src/core/errors";

export function createStripeGateway(options: {
  secretKey: string;
  webhookSecret: string;
}): PaymentGateway {
  const stripe = new Stripe(options.secretKey);

  return {
    id: "stripe",
    name: "Stripe",

    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(input.customerId
          ? {
              customer: input.customerId,
              customer_update: {
                address: "auto",
                name: "auto",
              },
            }
          : {
              customer_email: input.customerEmail,
              customer_creation: "always",
            }),
        payment_method_types: ["card", "link"],
        billing_address_collection: "auto",
        saved_payment_method_options: {
          payment_method_save: "enabled",
        },
        wallet_options: {
          link: {
            display: "auto",
          },
        },
        payment_intent_data: {
          setup_future_usage: "off_session",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amount,
              product_data: {
                name: `Invoice ${input.invoiceNumber}`,
              },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          paymentId: input.paymentId,
          invoiceId: input.invoiceId,
          ...input.metadata,
        },
      });

      if (!session.url) {
        throw new AppError("Stripe did not return a checkout URL", 502);
      }

      return {
        checkoutUrl: session.url,
        externalId: session.id,
      };
    },

    async handleWebhook(req: Request, rawBody: string): Promise<WebhookResult> {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        throw new AppError("Missing Stripe signature", 400);
      }

      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        options.webhookSecret,
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        let paymentMethodId: string | undefined;
        if (session.payment_intent) {
          if (typeof session.payment_intent === "string") {
            const intent = await stripe.paymentIntents.retrieve(
              session.payment_intent,
              { expand: ["payment_method"] },
            );
            paymentMethodId =
              typeof intent.payment_method === "string"
                ? intent.payment_method
                : intent.payment_method?.id;
          } else {
            paymentMethodId =
              typeof session.payment_intent.payment_method === "string"
                ? session.payment_intent.payment_method
                : session.payment_intent.payment_method?.id;
          }
        }

        return {
          handled: true,
          externalEventId: event.id,
          paymentExternalId: session.id,
          invoiceId: session.metadata?.invoiceId,
          status: "completed",
          amount: session.amount_total ?? undefined,
          customerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          paymentMethodId,
        };
      }

      return {
        handled: false,
        externalEventId: event.id,
      };
    },

    async refund(
      externalPaymentId: string,
      amount?: number,
    ): Promise<RefundResult> {
      const session = await stripe.checkout.sessions.retrieve(externalPaymentId, {
        expand: ["payment_intent"],
      });
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!paymentIntent) {
        throw new AppError("Unable to resolve Stripe payment intent", 400);
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntent,
        amount,
      });

      return {
        externalRefundId: refund.id,
        status: refund.status === "succeeded" ? "refunded" : "pending",
      };
    },

    async chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult> {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          ...input.metadata,
        },
      });

      return {
        externalId: intent.id,
        status:
          intent.status === "succeeded"
            ? "completed"
            : intent.status === "processing"
              ? "pending"
              : "failed",
      };
    },
  };
}
