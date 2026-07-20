"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<Announcement[]>(
    ["announcements"],
    "/api/v1/announcements",
  );

  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "client",
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/announcements", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Announcement created");
      setForm({ title: "", body: "", audience: form.audience });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (row: Announcement) =>
      apiFetch(`/api/v1/announcements/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !row.active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Announcements"
        description="Site-wide banners for the client area and store."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label required>Title</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>
          <MarkdownEditor
            label="Body"
            required
            value={form.body}
            onChange={(body) => setForm((f) => ({ ...f, body }))}
            hint="Markdown is rendered in client and store banners."
          />
          <div className="space-y-2">
            <Label>Audience</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({ ...f, audience: e.target.value }))
              }
            >
              <option value="client">Client area</option>
              <option value="store">Store</option>
              <option value="all">All</option>
            </select>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={
              !form.title.trim() || !form.body.trim() || create.isPending
            }
          >
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>{row.title}</div>
                      <div className="max-w-md truncate text-xs text-muted-foreground">
                        {row.body}
                      </div>
                    </TableCell>
                    <TableCell>{row.audience}</TableCell>
                    <TableCell>{row.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive.mutate(row)}
                      >
                        {row.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove.mutate(row.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
