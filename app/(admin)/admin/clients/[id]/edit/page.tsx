"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, useApiQuery } from "@/components/api";
import { EditPageChrome } from "@/components/admin/edit-page-chrome";
import { CountrySelect } from "@/components/ui/country-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Client = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  isAdmin: boolean;
  hasUserAccount: boolean;
};

export default function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useApiQuery<Client>(
    ["client", id],
    `/api/v1/clients/${id}`,
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    taxId: "",
    isAdmin: false,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!client) return;
    setForm({
      name: client.name,
      email: client.email,
      company: client.company ?? "",
      phone: client.phone ?? "",
      address1: client.address1 ?? "",
      address2: client.address2 ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      postalCode: client.postalCode ?? "",
      country: client.country ?? "",
      taxId: client.taxId ?? "",
      isAdmin: client.isAdmin ?? false,
    });
  }, [client]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          phone: form.phone || undefined,
          address1: form.address1 || undefined,
          address2: form.address2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          postalCode: form.postalCode || undefined,
          country: form.country || undefined,
          taxId: form.taxId || undefined,
          isAdmin: form.isAdmin,
        }),
      }),
    onSuccess: () => {
      toast.success("Client updated");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/admin/clients");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !client) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <EditPageChrome
      title={`Edit ${client.name}`}
      backHref="/admin/clients"
      backLabel="Back to clients"
      onSave={() => save.mutate()}
      onCancel={() => router.push("/admin/clients")}
      saving={save.isPending}
      showDelete
      onDelete={() => setConfirmOpen(true)}
      deleteTitle="Delete client?"
      deleteDescription="This permanently deletes the client and cascades related orders, invoices, services, and tickets."
      confirmOpen={confirmOpen}
      onCancelDelete={() => setConfirmOpen(false)}
      onConfirmDelete={() => remove.mutate()}
      deleting={remove.isPending}
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label required>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={form.company}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address1}
              onChange={(e) =>
                setForm((f) => ({ ...f, address1: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Address 2</Label>
            <Input
              value={form.address2}
              onChange={(e) =>
                setForm((f) => ({ ...f, address2: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input
                value={form.postalCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postalCode: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <CountrySelect
                value={form.country}
                onChange={(country) => setForm((f) => ({ ...f, country }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input
                value={form.taxId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxId: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isAdmin: e.target.checked }))
                }
              />
              Is Admin
            </label>
            {!client.hasUserAccount ? (
              <p className="text-xs text-muted-foreground">
                No login account is linked yet. The user must register before
                admin access can be granted.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Grants full access to the admin panel.
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            <Link className="underline" href={`/admin/clients`}>
              Return to list
            </Link>
          </p>
        </CardContent>
      </Card>
    </EditPageChrome>
  );
}
