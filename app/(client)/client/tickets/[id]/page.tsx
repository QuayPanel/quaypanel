"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Ticket = {
  id: string;
  number: string;
  subject: string;
  status: string;
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    author: { name: string };
  }>;
};

export default function ClientTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: ticket, isLoading } = useApiQuery<Ticket>(
    ["ticket", params.id],
    `/api/v1/tickets/${params.id}`,
  );
  const [body, setBody] = useState("");

  const reply = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tickets/${params.id}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["ticket", params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !ticket) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <PageMotion>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {ticket.number}: {ticket.subject}
        </h1>
        <Badge>{ticket.status}</Badge>
      </div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-md border p-3 text-sm"
            >
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {msg.author.name}
                  {msg.isStaff ? " (staff)" : ""}
                </span>
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p>{msg.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply..."
        />
        <Button disabled={!body || reply.isPending} onClick={() => reply.mutate()}>
          Send
        </Button>
      </div>
    </PageMotion>
  );
}
