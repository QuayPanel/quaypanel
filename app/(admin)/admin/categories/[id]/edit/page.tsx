"use client";

import { use } from "react";
import { CategoryFormPage } from "../../_form";

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CategoryFormPage mode="edit" categoryNumber={id} />;
}
