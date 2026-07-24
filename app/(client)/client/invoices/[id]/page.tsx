"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { CaptchaField, type CaptchaFieldHandle } from "@/components/captcha-field";
import { PaymentGatewayButtons } from "@/components/payment-gateway-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/src/core/utils";

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  items: Array<{ description: string; total: number }>;
};

type Payment = {
  checkoutUrl: string | null;
};

export default function ClientInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const captchaRef = useRef<CaptchaFieldHandle>(null);
  const { data: invoice, isLoading } = useApiQuery<Invoice>(
    ["invoice", id],
    `/api/v1/invoices/${id}`,
  );

  const pay = useMutation({
    mutationFn: async (gatewayId: string) => {
      const captchaToken = await captchaRef.current?.execute();
      return apiFetch<Payment>(`/api/v1/invoices/${id}/pay`, {
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
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (err: Error) => {
      captchaRef.current?.reset();
      toast.error(err.message);
    },
  });

  if (isLoading || !invoice) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <PageMotion>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoice {invoice.number}</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/client/invoices/${encodeURIComponent(invoice.number)}/pdf`}
            >
              View PDF
            </Link>
          </Button>
          <Badge>{invoice.status}</Badge>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Total {formatMoney(invoice.total, invoice.currency)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {invoice.items.map((item, idx) => (
              <li key={idx} className="flex justify-between border-b py-2">
                <span>{item.description}</span>
                <span>{formatMoney(item.total, invoice.currency)}</span>
              </li>
            ))}
          </ul>
          {invoice.status === "UNPAID" && (
            <div className="space-y-3">
              <CaptchaField ref={captchaRef} />
              <PaymentGatewayButtons
                onPay={(gatewayId) => pay.mutate(gatewayId)}
                disabled={pay.isPending}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
