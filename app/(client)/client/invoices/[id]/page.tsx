"use client";

import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
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
  const { data: invoice, isLoading } = useApiQuery<Invoice>(
    ["invoice", id],
    `/api/v1/invoices/${id}`,
  );

  const pay = useMutation({
    mutationFn: (gatewayId: "stripe" | "paypal") =>
      apiFetch<Payment>(`/api/v1/invoices/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ gatewayId }),
      }),
    onSuccess: (payment) => {
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      } else {
        toast.error("No checkout URL returned");
      }
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (err: Error) => toast.error(err.message),
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
            <a
              href={`/api/v1/invoices/${encodeURIComponent(invoice.number)}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
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
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => pay.mutate("stripe")}>Pay with Stripe</Button>
              <Button variant="outline" onClick={() => pay.mutate("paypal")}>
                Pay with PayPal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
