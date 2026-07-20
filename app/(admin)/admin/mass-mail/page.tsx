import { redirect } from "next/navigation";

/** Mass mail was replaced by Mail campaigns. */
export default function MassMailRedirectPage() {
  redirect("/admin/mail-campaigns");
}
