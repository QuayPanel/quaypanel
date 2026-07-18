"use client";

import { use } from "react";
import { CouponFormPage } from "../../_form";

export default function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CouponFormPage mode="edit" couponNumber={id} />;
}
