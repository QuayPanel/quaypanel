import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { isPublicNumberId } from "@/src/core/public-id";
import { slugify } from "@/src/core/utils";
import { writeAuditLog } from "@/src/domains/audit/service";

export const knowledgeArticleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  shortDescription: z.string().optional(),
  body: z.string().min(1),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  categoryId: z.string().nullable().optional(),
});

export const knowledgeCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const knowledgeReorderSchema = z.object({
  type: z.enum(["category", "article"]),
  parentId: z.string().nullable().optional(),
  orderedIds: z.array(z.string()).min(1),
});

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  body: string;
  published: boolean;
  publishedAt: Date | null;
  categoryId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type KnowledgeTreeNode = CategoryRow & {
  children: KnowledgeTreeNode[];
  articles: ArticleRow[];
};

/** Manual sortOrder 1+ wins; 0 falls back to published date (newest first). */
export function compareKnowledgeArticles<
  T extends {
    sortOrder?: number | null;
    publishedAt?: Date | string | null;
    createdAt?: Date | string | null;
    title?: string | null;
  },
>(a: T, b: T): number {
  const ao = Number(a.sortOrder ?? 0);
  const bo = Number(b.sortOrder ?? 0);
  if (ao === 0 && bo === 0) {
    const at = articleDateMs(a);
    const bt = articleDateMs(b);
    if (bt !== at) return bt - at;
    return String(a.title ?? "").localeCompare(String(b.title ?? ""));
  }
  if (ao === 0) return 1;
  if (bo === 0) return -1;
  if (ao !== bo) return ao - bo;
  return articleDateMs(b) - articleDateMs(a);
}

function articleDateMs(a: {
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): number {
  const raw = a.publishedAt ?? a.createdAt;
  if (!raw) return 0;
  return new Date(raw).getTime();
}

export function compareKnowledgeCategories<
  T extends { sortOrder?: number | null; name?: string | null },
>(a: T, b: T): number {
  const ao = Number(a.sortOrder ?? 0);
  const bo = Number(b.sortOrder ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a.name ?? "").localeCompare(String(b.name ?? ""));
}

function articleSearchWhere(q: string) {
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { shortDescription: { contains: q, mode: "insensitive" as const } },
      { body: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

export async function listKnowledgeArticles(opts?: {
  publishedOnly?: boolean;
  q?: string;
  categoryId?: string | null;
}) {
  const publishedOnly = opts?.publishedOnly ?? false;
  const q = opts?.q?.trim();
  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      ...(publishedOnly ? { published: true } : {}),
      ...(q ? articleSearchWhere(q) : {}),
      ...(opts?.categoryId !== undefined
        ? { categoryId: opts.categoryId }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  return [...articles].sort(compareKnowledgeArticles);
}

export async function getKnowledgeArticle(idOrSlug: string) {
  const raw = decodeURIComponent(String(idOrSlug));
  const article = isPublicNumberId(raw)
    ? await prisma.knowledgeArticle.findUnique({
        where: { number: Number(raw) },
        include: {
          category: { select: { id: true, name: true, slug: true, number: true } },
        },
      })
    : await prisma.knowledgeArticle.findFirst({
        where: {
          OR: [{ id: raw }, { slug: raw }],
        },
        include: {
          category: { select: { id: true, name: true, slug: true, number: true } },
        },
      });
  if (!article) throw new NotFoundError("Article not found");
  return article;
}

async function assertCategoryExists(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const cat = await prisma.knowledgeCategory.findUnique({
    where: { id: categoryId },
  });
  if (!cat) throw new ValidationError("Category not found");
}

function resolvePublishedAt(
  nextPublished: boolean | undefined,
  previous: { published: boolean; publishedAt: Date | null },
): Date | null | undefined {
  if (nextPublished === undefined) return undefined;
  if (nextPublished) {
    if (previous.published && previous.publishedAt) return previous.publishedAt;
    return new Date();
  }
  return null;
}

export async function createKnowledgeArticle(
  data: z.infer<typeof knowledgeArticleSchema>,
  actorId?: string,
) {
  const parsed = knowledgeArticleSchema.parse(data);
  await assertCategoryExists(parsed.categoryId);
  const slug = slugify(parsed.slug || parsed.title);
  const published = parsed.published ?? false;
  const article = await prisma.knowledgeArticle.create({
    data: {
      title: parsed.title,
      slug,
      shortDescription: parsed.shortDescription?.trim() ?? "",
      body: parsed.body,
      published,
      publishedAt: published ? new Date() : null,
      categoryId: parsed.categoryId ?? null,
      sortOrder: parsed.sortOrder ?? 0,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  await writeAuditLog({
    actorId,
    action: "knowledge.create",
    entityType: "knowledge_article",
    entityId: article.id,
  });
  return article;
}

export async function updateKnowledgeArticle(
  idOrSlug: string,
  data: Partial<z.infer<typeof knowledgeArticleSchema>>,
  actorId?: string,
) {
  const existing = await getKnowledgeArticle(idOrSlug);
  const parsed = knowledgeArticleSchema.partial().parse(data);
  if (parsed.categoryId !== undefined) {
    await assertCategoryExists(parsed.categoryId);
  }
  const publishedAt = resolvePublishedAt(parsed.published, existing);
  const article = await prisma.knowledgeArticle.update({
    where: { id: existing.id },
    data: {
      title: parsed.title,
      slug: parsed.slug ? slugify(parsed.slug) : undefined,
      shortDescription:
        parsed.shortDescription !== undefined
          ? parsed.shortDescription.trim()
          : undefined,
      body: parsed.body,
      published: parsed.published,
      publishedAt,
      categoryId: parsed.categoryId,
      sortOrder: parsed.sortOrder,
    },
    include: {
      category: { select: { id: true, name: true, slug: true, number: true } },
    },
  });
  await writeAuditLog({
    actorId,
    action: "knowledge.update",
    entityType: "knowledge_article",
    entityId: article.id,
  });
  return article;
}

export async function deleteKnowledgeArticle(
  idOrSlug: string,
  actorId?: string,
) {
  const existing = await getKnowledgeArticle(idOrSlug);
  await prisma.knowledgeArticle.delete({ where: { id: existing.id } });
  await writeAuditLog({
    actorId,
    action: "knowledge.delete",
    entityType: "knowledge_article",
    entityId: existing.id,
  });
  return { ok: true };
}

export async function listKnowledgeCategories() {
  const categories = await prisma.knowledgeCategory.findMany();
  return [...categories].sort(compareKnowledgeCategories);
}

export async function getKnowledgeCategory(idOrSlug: string) {
  const raw = decodeURIComponent(String(idOrSlug));
  const category = isPublicNumberId(raw)
    ? await prisma.knowledgeCategory.findUnique({
        where: { number: Number(raw) },
      })
    : await prisma.knowledgeCategory.findFirst({
        where: { OR: [{ id: raw }, { slug: raw }] },
      });
  if (!category) throw new NotFoundError("Category not found");
  return category;
}

async function assertValidParent(
  parentId: string | null | undefined,
  selfId?: string,
) {
  if (!parentId) return;
  if (selfId && parentId === selfId) {
    throw new ValidationError("Category cannot be its own parent");
  }
  const parent = await prisma.knowledgeCategory.findUnique({
    where: { id: parentId },
  });
  if (!parent) throw new ValidationError("Parent category not found");
  if (selfId) {
    // Prevent cycles: walk up from proposed parent
    let cursor: string | null = parentId;
    const seen = new Set<string>([selfId]);
    while (cursor) {
      if (seen.has(cursor)) {
        throw new ValidationError("Category cannot be nested under itself");
      }
      seen.add(cursor);
      const row: { parentId: string | null } | null =
        await prisma.knowledgeCategory.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = row?.parentId ?? null;
    }
  }
}

export async function createKnowledgeCategory(
  data: z.infer<typeof knowledgeCategorySchema>,
  actorId?: string,
) {
  const parsed = knowledgeCategorySchema.parse(data);
  await assertValidParent(parsed.parentId);
  const siblingCount = await prisma.knowledgeCategory.count({
    where: { parentId: parsed.parentId ?? null },
  });
  const slugBase = slugify(parsed.slug || parsed.name);
  let slug = slugBase;
  let n = 2;
  while (await prisma.knowledgeCategory.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${n++}`;
  }
  const category = await prisma.knowledgeCategory.create({
    data: {
      name: parsed.name.trim(),
      slug,
      parentId: parsed.parentId ?? null,
      sortOrder: parsed.sortOrder ?? siblingCount + 1,
    },
  });
  await writeAuditLog({
    actorId,
    action: "knowledge.category.create",
    entityType: "knowledge_category",
    entityId: category.id,
  });
  return category;
}

export async function updateKnowledgeCategory(
  idOrSlug: string,
  data: Partial<z.infer<typeof knowledgeCategorySchema>>,
  actorId?: string,
) {
  const existing = await getKnowledgeCategory(idOrSlug);
  const parsed = knowledgeCategorySchema.partial().parse(data);
  if (parsed.parentId !== undefined) {
    await assertValidParent(parsed.parentId, existing.id);
  }
  const category = await prisma.knowledgeCategory.update({
    where: { id: existing.id },
    data: {
      name: parsed.name?.trim(),
      slug: parsed.slug ? slugify(parsed.slug) : undefined,
      parentId: parsed.parentId,
      sortOrder: parsed.sortOrder,
    },
  });
  await writeAuditLog({
    actorId,
    action: "knowledge.category.update",
    entityType: "knowledge_category",
    entityId: category.id,
  });
  return category;
}

export async function deleteKnowledgeCategory(
  idOrSlug: string,
  actorId?: string,
) {
  const existing = await getKnowledgeCategory(idOrSlug);
  await prisma.knowledgeCategory.delete({ where: { id: existing.id } });
  await writeAuditLog({
    actorId,
    action: "knowledge.category.delete",
    entityType: "knowledge_category",
    entityId: existing.id,
  });
  return { ok: true };
}

export async function reorderKnowledgeItems(
  data: z.infer<typeof knowledgeReorderSchema>,
  actorId?: string,
) {
  const parsed = knowledgeReorderSchema.parse(data);
  const parentId = parsed.parentId ?? null;

  if (parsed.type === "category") {
    const siblings = await prisma.knowledgeCategory.findMany({
      where: { parentId },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (
      parsed.orderedIds.length !== siblingIds.size ||
      !parsed.orderedIds.every((id) => siblingIds.has(id))
    ) {
      throw new ValidationError("Invalid category reorder set");
    }
    await prisma.$transaction(
      parsed.orderedIds.map((id, index) =>
        prisma.knowledgeCategory.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  } else {
    const siblings = await prisma.knowledgeArticle.findMany({
      where: { categoryId: parentId },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (
      parsed.orderedIds.length !== siblingIds.size ||
      !parsed.orderedIds.every((id) => siblingIds.has(id))
    ) {
      throw new ValidationError("Invalid article reorder set");
    }
    await prisma.$transaction(
      parsed.orderedIds.map((id, index) =>
        prisma.knowledgeArticle.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  await writeAuditLog({
    actorId,
    action: "knowledge.reorder",
    entityType:
      parsed.type === "category" ? "knowledge_category" : "knowledge_article",
    entityId: parentId ?? "root",
    metadata: { orderedIds: parsed.orderedIds },
  });
  return { ok: true };
}

export async function getKnowledgeTree(publishedOnly = false) {
  const [categories, articles] = await Promise.all([
    prisma.knowledgeCategory.findMany(),
    prisma.knowledgeArticle.findMany({
      where: publishedOnly ? { published: true } : undefined,
    }),
  ]);

  const byParent = new Map<string | null, CategoryRow[]>();
  for (const cat of categories) {
    const key = cat.parentId;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(compareKnowledgeCategories);
  }

  const articlesByCategory = new Map<string | null, ArticleRow[]>();
  for (const article of articles) {
    const key = article.categoryId;
    const list = articlesByCategory.get(key) ?? [];
    list.push(article);
    articlesByCategory.set(key, list);
  }
  for (const list of articlesByCategory.values()) {
    list.sort(compareKnowledgeArticles);
  }

  function build(parentId: string | null): KnowledgeTreeNode[] {
    const kids = byParent.get(parentId) ?? [];
    return kids
      .map((cat) => ({
        ...cat,
        children: build(cat.id),
        articles: articlesByCategory.get(cat.id) ?? [],
      }))
      .filter((node) => {
        if (!publishedOnly) return true;
        return (
          node.articles.length > 0 ||
          node.children.length > 0
        );
      });
  }

  return {
    categories: build(null),
    uncategorized: articlesByCategory.get(null) ?? [],
  };
}
