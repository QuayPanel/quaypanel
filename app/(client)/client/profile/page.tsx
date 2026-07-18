"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "@/components/ui/country-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Me = {
  name: string;
  email: string;
  role: string;
  client: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
};

export default function ClientProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiQuery<Me>(["me"], "/api/v1/me");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  useEffect(() => {
    if (!data?.client) return;
    const c = data.client;
    const parts = c.name.split(" ");
    setForm({
      firstName: c.firstName ?? parts[0] ?? "",
      lastName: c.lastName ?? parts.slice(1).join(" "),
      company: c.company ?? "",
      phone: c.phone ?? "",
      address1: c.address1 ?? "",
      address2: c.address2 ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      postalCode: c.postalCode ?? "",
      country: c.country ?? "",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          name: `${form.firstName} ${form.lastName}`.trim() || undefined,
          company: form.company || undefined,
          phone: form.phone || undefined,
          address1: form.address1 || undefined,
          address2: form.address2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          postalCode: form.postalCode || undefined,
          country: form.country || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <h1 className="mb-6 text-2xl font-semibold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isLoading || !data ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Login email:</span>{" "}
                {data.email}
              </p>
              <p>
                <span className="text-muted-foreground">Role:</span> {data.role}
              </p>
              {data.client ? (
                <div className="space-y-4 border-t pt-4">
                  <p className="font-medium">Billing profile</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>First name</Label>
                      <Input
                        value={form.firstName}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, firstName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last name</Label>
                      <Input
                        value={form.lastName}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, lastName: e.target.value }))
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
                          setForm((f) => ({
                            ...f,
                            postalCode: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <CountrySelect
                      value={form.country}
                      onChange={(country) =>
                        setForm((f) => ({ ...f, country }))
                      }
                    />
                  </div>
                  <Button
                    disabled={save.isPending}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No billing profile linked.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
