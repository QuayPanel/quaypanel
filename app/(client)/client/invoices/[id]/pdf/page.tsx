"use client";

import { use } from "react";
import { InvoicePdfViewer } from "@/components/invoice-pdf-viewer";

export default function ClientInvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <InvoicePdfViewer
      invoiceId={id}
      backHref={`/client/invoices/${encodeURIComponent(id)}`}
      backLabel="Back to invoice"
      showPay
    />
  );
}
