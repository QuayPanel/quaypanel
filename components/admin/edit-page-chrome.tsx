"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageMotion } from "@/components/motion";

export function EditPageChrome({
  title,
  description,
  backHref,
  backLabel = "Back",
  children,
  onSave,
  onCancel,
  saving,
  showDelete,
  onDelete,
  deleteTitle = "Delete item?",
  deleteDescription = "This action cannot be undone.",
  confirmOpen,
  onConfirmDelete,
  onCancelDelete,
  deleting,
}: {
  title: string;
  description?: string;
  backHref: string;
  backLabel?: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  deleteTitle?: string;
  deleteDescription?: string;
  confirmOpen?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={backHref} className="underline">
              {backLabel}
            </Link>
          </p>
        </div>
        {showDelete && onDelete && (
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>

      <div className="space-y-6">{children}</div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {showDelete && (
        <ConfirmDialog
          open={Boolean(confirmOpen)}
          title={deleteTitle}
          description={deleteDescription}
          onCancel={onCancelDelete ?? (() => undefined)}
          onConfirm={onConfirmDelete ?? (() => undefined)}
          loading={deleting}
        />
      )}
    </PageMotion>
  );
}
