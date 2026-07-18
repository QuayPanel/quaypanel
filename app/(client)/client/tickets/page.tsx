"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Ticket = {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
};

type Me = { clientId: string | null };

export default function ClientTicketsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useApiQuery<Me>(["me"], "/api/v1/me");
  const { data = [], isLoading } = useApiQuery<Ticket[]>(
    ["client-tickets"],
    "/api/v1/tickets",
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!me?.clientId) throw new Error("Missing client");
      return apiFetch("/api/v1/tickets", {
        method: "POST",
        body: JSON.stringify({
          clientId: me.clientId,
          subject,
          body,
          priority: "MEDIUM",
        }),
      });
    },
    onSuccess: () => {
      toast.success("Ticket created");
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["client-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Tickets</h1>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Input value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button onClick={() => create.mutate()}>Open ticket</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-xs">
                        {ticket.number}
                      </TableCell>
                      <TableCell>{ticket.subject}</TableCell>
                      <TableCell>
                        <Badge>{ticket.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/client/tickets/${encodeURIComponent(ticket.number)}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
