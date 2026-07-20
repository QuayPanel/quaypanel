"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/components/api";

export function ImpersonationExitButton() {
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await apiFetch("/api/v1/me/impersonate", { method: "DELETE" }).catch(
          () => undefined,
        );
        router.push("/admin/clients");
        router.refresh();
      }}
    >
      Exit impersonation
    </Button>
  );
}
