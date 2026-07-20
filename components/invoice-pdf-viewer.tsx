"use client";

import Link from "next/link";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { CaptchaField, type CaptchaFieldHandle } from "@/components/captcha-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/src/core/utils";

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
};

type Payment = {
  checkoutUrl: string | null;
};

export function InvoicePdfViewer({
  invoiceId,
  backHref,
  backLabel,
  showPay,
  requireCaptcha,
}: {
  invoiceId: string;
  backHref: string;
  backLabel: string;
  showPay?: boolean;
  /** When true (client portal), captcha is required for pay if enabled in settings. */
  requireCaptcha?: boolean;
}) {
  const queryClient = useQueryClient();
  const captchaRef = useRef<CaptchaFieldHandle>(null);
  const { data: invoice, isLoading } = useApiQuery<Invoice>(
    ["invoice", invoiceId],
    `/api/v1/invoices/${invoiceId}`,
  );

  const pdfSrc = `/api/v1/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  const downloadSrc = `${pdfSrc}?download=1`;

  const pay = useMutation({
    mutationFn: async (gatewayId: "stripe" | "paypal") => {
      const captchaToken = requireCaptcha
        ? await captchaRef.current?.execute()
        : undefined;
      return apiFetch<Payment>(`/api/v1/invoices/${invoiceId}/pay`, {
        method: "POST",
        body: JSON.stringify({ gatewayId, captchaToken }),
      });
    },
    onSuccess: (payment) => {
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      } else {
        toast.error("No checkout URL returned");
      }
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    },
    onError: (err: Error) => {
      captchaRef.current?.reset();
      toast.error(err.message);
    },
  });

  if (isLoading || !invoice) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const unpaid = invoice.status === "UNPAID";

  return (
    <PageMotion>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Invoice {invoice.number}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={backHref} className="underline">
              {backLabel}
            </Link>
            {" · "}
            {formatMoney(invoice.total, invoice.currency)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{invoice.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <a href={downloadSrc}>Download PDF</a>
          </Button>
        </div>
      </div>

      {showPay && unpaid ? (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm font-medium">Pay this invoice</p>
            <Button
              onClick={() => pay.mutate("stripe")}
              disabled={pay.isPending}
            >
              Pay with Stripe
            </Button>
            <Button
              variant="outline"
              onClick={() => pay.mutate("paypal")}
              disabled={pay.isPending}
            >
              Pay with PayPal
            </Button>
          </div>
          {requireCaptcha ? <CaptchaField ref={captchaRef} /> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <iframe
          title={`Invoice ${invoice.number} PDF`}
          src={pdfSrc}
          className="h-[min(80vh,900px)] w-full bg-white"
        />
      </div>

      {showPay && unpaid ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <Button
            onClick={() => pay.mutate("stripe")}
            disabled={pay.isPending}
          >
            Pay with Stripe
          </Button>
          <Button
            variant="outline"
            onClick={() => pay.mutate("paypal")}
            disabled={pay.isPending}
          >
            Pay with PayPal
          </Button>
        </div>
      ) : null}
    </PageMotion>
  );
}
