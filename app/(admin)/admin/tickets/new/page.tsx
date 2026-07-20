"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Client = { id: string; name: string; email: string };
type CreatedTicket = { number: string };

export default function NewTicketPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useApiQuery<Client[]>(
    ["clients"],
    "/api/v1/clients",
  );

  const [clientId, setClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const create = useMutation({
    mutationFn: () =>
      apiFetch<CreatedTicket>("/api/v1/tickets", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          subject: subject.trim(),
          body: body.trim(),
          priority,
        }),
      }),
    onSuccess: (ticket) => {
      toast.success("Ticket created");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      router.push(`/admin/tickets/${encodeURIComponent(ticket.number)}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="New ticket"
        description="Open a support ticket on behalf of a client."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Ticket details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <select
              id="client"
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
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
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="How can we help?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <textarea
              id="body"
              className="min-h-32 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the issue or request…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/tickets")}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                !clientId ||
                subject.trim().length < 3 ||
                !body.trim() ||
                create.isPending
              }
            >
              {create.isPending ? "Creating..." : "Create ticket"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
