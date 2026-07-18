"use client";

import { use } from "react";
import { ConfigOptionFormPage } from "../../_form";

export default function EditConfigOptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ConfigOptionFormPage mode="edit" optionNumber={id} />;
}
