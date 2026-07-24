"use client";

import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/components/api";

type Gateway = { id: string; name: string };

export function PaymentGatewayButtons({
  onPay,
  disabled,
  className,
}: {
  onPay: (gatewayId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { data: gateways = [], isLoading } = useApiQuery<Gateway[]>(
    ["enabled-payment-gateways"],
    "/api/v1/payments/gateways",
  );

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading payment options...</p>
    );
  }

  if (gateways.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payment gateways are currently enabled.
      </p>
    );
  }

  return (
    <div className={className ?? "flex flex-wrap gap-3"}>
      {gateways.map((gateway, index) => (
        <Button
          key={gateway.id}
          variant={index === 0 ? "default" : "outline"}
          onClick={() => onPay(gateway.id)}
          disabled={disabled}
        >
          Pay with {gateway.name}
        </Button>
      ))}
    </div>
  );
}
