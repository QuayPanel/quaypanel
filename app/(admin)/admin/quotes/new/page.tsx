"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Client = { id: string; name: string; email: string };

export default function NewQuotePage() {
  const router = useRouter();
  const { data: clients = [] } = useApiQuery<Client[]>(
    ["clients"],
    "/api/v1/clients",
  );

  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/quotes", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          note: note || undefined,
          items: [
            {
              description: description || "Custom service",
              quantity: 1,
              unitPrice: Number(amount),
            },
          ],
        }),
      }),
    onSuccess: () => {
      toast.success("Quote created");
      router.push("/admin/quotes");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader title="New quote" description="Create a quote for a client." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Quote details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Line item description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Custom hosting package"
            />
          </div>
          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || create.isPending}
          >
            {create.isPending ? "Creating..." : "Create quote"}
          </Button>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
