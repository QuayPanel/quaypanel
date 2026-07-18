import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { slugify } from "@/src/core/utils";
import { writeAuditLog } from "@/src/domains/audit/service";
import { cacheDel, cacheKey } from "@/src/core/redis";

const CATALOG_CACHE = cacheKey("catalog", "products");

const parentSelect = {
  id: true,
  number: true,
  name: true,
  slug: true,
} as const;

export const categoryCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});

/** Resolve category by public number (`1`) or internal cuid. */
export async function resolveCategoryId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (/^\d+$/.test(raw)) {
    const category = await prisma.category.findUnique({
      where: { number: Number(raw) },
    });
    if (!category) throw new NotFoundError("Category not found");
    return category.id;
  }
  return raw;
}

async function assertValidParent(categoryId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (categoryId && parentId === categoryId) {
    throw new ValidationError("A category cannot be its own parent");
  }
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw new ValidationError("Parent category not found");

  if (!categoryId) return;

  // Walk up from parent — reject if we hit categoryId (cycle)
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === categoryId) {
      throw new ValidationError("Cannot set a descendant as parent");
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const row: { parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
    cursor = row?.parentId ?? null;
  }
}

export async function listCategories(activeOnly = false) {
  return prisma.category.findMany({
    where: activeOnly ? { active: true } : undefined,
    include: {
      parent: { select: parentSelect },
      children: activeOnly
        ? {
            where: { active: true },
            select: {
              id: true,
              name: true,
              slug: true,
              sortOrder: true,
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          }
        : {
            select: {
              id: true,
              name: true,
              slug: true,
              sortOrder: true,
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
      _count: { select: { children: true } },
      products: activeOnly
        ? {
            where: { active: true, hidden: false },
            include: { plans: { where: { active: true } } },
          }
        : { include: { plans: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });
}

export async function getCategory(idOrNumber: string | number) {
  const id = await resolveCategoryId(idOrNumber);
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: { select: parentSelect },
      _count: { select: { children: true } },
    },
  });
  if (!category) throw new NotFoundError("Category not found");
  return category;
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: parentSelect },
      children: {
        where: { active: true },
        select: {
          id: true,
          number: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      products: {
        where: { active: true, hidden: false },
        include: {
          plans: { where: { active: true }, orderBy: { price: "asc" } },
          configOptions: {
            where: { configOption: { hidden: false } },
            select: { id: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!category) throw new NotFoundError("Category not found");

  const childIds = category.children.map((c) => c.id);
  const subtreeIds = [category.id, ...childIds];

  // One level of grandchildren for featured sweep
  if (childIds.length > 0) {
    const grandchildren = await prisma.category.findMany({
      where: { parentId: { in: childIds }, active: true },
      select: { id: true },
    });
    for (const g of grandchildren) subtreeIds.push(g.id);
  }

  const featuredProducts = await prisma.product.findMany({
    where: {
      active: true,
      hidden: false,
      featured: true,
      categoryId: { in: subtreeIds },
    },
    include: {
      plans: { where: { active: true }, orderBy: { price: "asc" } },
      configOptions: {
        where: { configOption: { hidden: false } },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return {
    ...category,
    products: category.products.map((p) => ({
      ...p,
      configOptionCount: p.configOptions.length,
      configOptions: undefined,
    })),
    featuredProducts: featuredProducts.map((p) => ({
      ...p,
      configOptionCount: p.configOptions.length,
      configOptions: undefined,
    })),
  };
}

export async function createCategory(
  data: z.infer<typeof categoryCreateSchema>,
  actorId?: string,
) {
  await assertValidParent(null, data.parentId ?? null);
  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: slugify(data.slug || data.name),
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
      parentId: data.parentId ?? null,
    },
    include: {
      parent: { select: parentSelect },
      _count: { select: { children: true } },
    },
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "category.create",
    entityType: "category",
    entityId: category.id,
    metadata: { number: category.number },
  });
  return category;
}

export async function updateCategory(
  idOrNumber: string | number,
  data: Partial<z.infer<typeof categoryCreateSchema>>,
  actorId?: string,
) {
  const id = await resolveCategoryId(idOrNumber);
  await getCategory(id);
  if (data.parentId !== undefined) {
    await assertValidParent(id, data.parentId);
  }
  const category = await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug === undefined ? undefined : slugify(data.slug),
      description:
        data.description === undefined ? undefined : data.description,
      imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl,
      sortOrder: data.sortOrder,
      active: data.active,
      parentId: data.parentId === undefined ? undefined : data.parentId,
    },
    include: {
      parent: { select: parentSelect },
      _count: { select: { children: true } },
    },
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "category.update",
    entityType: "category",
    entityId: category.id,
  });
  return category;
}

export async function deleteCategories(
  idsOrNumbers: Array<string | number>,
  actorId?: string,
) {
  const ids: string[] = [];
  for (const value of idsOrNumbers) {
    ids.push(await resolveCategoryId(value));
  }
  if (ids.length === 0) return { count: 0 };
  const result = await prisma.category.deleteMany({
    where: { id: { in: ids } },
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "category.delete",
    entityType: "category",
    metadata: { ids },
  });
  return result;
}
