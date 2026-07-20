"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/src/auth/permission-keys";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

export default function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useApiQuery<StaffUser[]>(
    ["staff"],
    "/api/v1/staff",
  );

  const update = useMutation({
    mutationFn: ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: string[];
    }) =>
      apiFetch(`/api/v1/staff/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions }),
      }),
    onSuccess: () => {
      toast.success("Permissions updated");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageMotion>
      <PageHeader
        title="Staff permissions"
        description="Control what STAFF users can access. Admins always have full access."
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          {data.map((user) => (
            <Card key={user.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{user.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge>{user.role}</Badge>
              </CardHeader>
              <CardContent>
                {user.role === "ADMIN" ? (
                  <p className="text-sm text-muted-foreground">
                    Admin users have all permissions.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {PERMISSIONS.map((perm) => {
                      const checked = user.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? user.permissions.filter((p) => p !== perm)
                                : [...user.permissions, perm];
                              update.mutate({
                                userId: user.id,
                                permissions: next,
                              });
                            }}
                          />
                          {perm}
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageMotion>
  );
}
