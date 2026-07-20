export type CheckoutInput = {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type CheckoutResult = {
  checkoutUrl: string;
  externalId: string;
};

export type WebhookResult = {
  handled: boolean;
  externalEventId: string;
  paymentExternalId?: string;
  invoiceId?: string;
  status?: "completed" | "failed" | "pending";
  amount?: number;
  customerId?: string;
  paymentMethodId?: string;
};

export type RefundResult = {
  externalRefundId: string;
  status: "refunded" | "pending";
};

export type ChargeCustomerInput = {
  customerId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  metadata?: Record<string, string>;
};

export type ChargeCustomerResult = {
  externalId: string;
  status: "completed" | "failed" | "pending";
};

export interface PaymentGateway {
  id: string;
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  handleWebhook(req: Request, rawBody: string): Promise<WebhookResult>;
  refund(externalPaymentId: string, amount?: number): Promise<RefundResult>;
  chargeCustomer?(
    input: ChargeCustomerInput,
  ): Promise<ChargeCustomerResult>;
}
