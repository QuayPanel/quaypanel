"use client";

import { useParams } from "next/navigation";
import { KnowledgeArticleFormPage } from "../_form";

export default function AdminKnowledgeEditPage() {
  const params = useParams<{ id: string }>();
  return <KnowledgeArticleFormPage mode="edit" articleId={params.id} />;
}
