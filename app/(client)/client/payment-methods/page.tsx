"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

function formatBrand(brand: string) {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function formatExpiry(expMonth: number, expYear: number) {
  const month = String(expMonth).padStart(2, "0");
  const year = String(expYear).slice(-2);
  return `${month}/${year}`;
}

export default function ClientPaymentMethodsPage() {
  const queryClient = useQueryClient();
  const { data: methods, isLoading } = useApiQuery<PaymentMethod[]>(
    ["client-payment-methods"],
    "/api/v1/payment-methods",
  );

  const setDefault = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/payment-methods/${encodeURIComponent(id)}`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Default payment method updated");
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/payment-methods/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Payment method removed");
      queryClient.invalidateQueries({ queryKey: ["client-payment-methods"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Payment methods</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !methods?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No saved payment methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Pay an invoice with Stripe to save a card or Link account for
              faster checkout and automatic renewals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {methods.map((method) => (
            <Card key={method.id}>
              <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {formatBrand(method.brand)} ending in {method.last4}
                      </p>
                      {method.isDefault && <Badge>Default</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expires {formatExpiry(method.expMonth, method.expYear)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!method.isDefault && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(method.id)}
                    >
                      Set default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(method.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageMotion>
  );
}
