"use client";

import { use } from "react";
import { ProductFormPage } from "../../_form";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductFormPage mode="edit" productNumber={id} />;
}
