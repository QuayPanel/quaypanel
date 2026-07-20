"use client";

import { use } from "react";
import { InvoicePdfViewer } from "@/components/invoice-pdf-viewer";

export default function AdminInvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <InvoicePdfViewer
      invoiceId={id}
      backHref={`/admin/invoices/${encodeURIComponent(id)}/edit`}
      backLabel="Back to invoice"
      showPay
    />
  );
}
