import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { slugify } from "@/src/core/utils";
import { cacheDel, cacheGet, cacheSet, cacheKey } from "@/src/core/redis";
import { writeAuditLog } from "@/src/domains/audit/service";
import type { BillingPeriod, PlanType } from "@/src/generated/prisma/client";
import { compareConfigOptionOrder } from "@/src/domains/config-options/order";

const CATALOG_CACHE = cacheKey("catalog", "products");

/** Lowest active/listed plan price; products with no plans sort last. */
export function startingPriceMinor(product: {
  plans: Array<{ price: number }>;
}): number {
  if (!product.plans.length) return Number.POSITIVE_INFINITY;
  return Math.min(...product.plans.map((p) => p.price));
}

/** Storefront order: cheaper starting price first, then name. */
export function sortProductsByStartingPrice<
  T extends { plans: Array<{ price: number }>; name?: string | null },
>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const pa = startingPriceMinor(a);
    const pb = startingPriceMinor(b);
    if (pa !== pb) return pa - pb;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

const productDetailInclude = {
  category: true,
  plans: true,
  upgrades: {
    include: {
      targetProduct: {
        select: { id: true, number: true, name: true, slug: true },
      },
    },
  },
};

export const productCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  slug: z.string().optional(),
  active: z.boolean().optional(),
  hidden: z.boolean().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  allowQuantity: z.enum(["NO", "SEPARATED", "COMBINED"]).optional(),
  categoryId: z.string().nullable().optional(),
  imageUrl: z.string().optional().nullable(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  provisionProvider: z.string().optional(),
  provisionConfig: z.record(z.string(), z.unknown()).optional(),
});

export const planFieldsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().int().nonnegative(),
  priceFormula: z.string().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["FREE", "ONE_TIME", "RECURRING"]).default("RECURRING"),
  intervalCount: z.number().int().positive().default(1),
  billingPeriod: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).default("MONTH"),
  setupFee: z.number().int().nonnegative().default(0),
  active: z.boolean().optional(),
});

export const planCreateSchema = planFieldsSchema.extend({
  productId: z.string().min(1),
});

export const productSaveSchema = productCreateSchema.extend({
  plans: z.array(planFieldsSchema).optional(),
  upgradeProductIds: z.array(z.string()).optional(),
});

export function deriveIntervalString(
  type: PlanType | string,
  intervalCount: number,
  billingPeriod: BillingPeriod | string,
): string {
  if (type === "FREE" || type === "ONE_TIME") return "once";
  const period = String(billingPeriod).toLowerCase();
  return intervalCount === 1 ? period : `${intervalCount} ${period}`;
}

function normalizePlanFields(data: z.infer<typeof planFieldsSchema>) {
  const type = data.type;
  const price = type === "FREE" ? 0 : data.price;
  const intervalCount = type === "RECURRING" ? data.intervalCount : 1;
  const billingPeriod = type === "RECURRING" ? data.billingPeriod : "MONTH";
  return {
    name: data.name,
    description: data.description ?? null,
    price,
    priceFormula:
      type === "FREE"
        ? null
        : data.priceFormula != null && String(data.priceFormula).trim()
          ? String(data.priceFormula).trim()
          : null,
    currency: data.currency ?? "USD",
    type,
    intervalCount,
    billingPeriod,
    setupFee: data.setupFee ?? 0,
    interval: deriveIntervalString(type, intervalCount, billingPeriod),
    active: data.active ?? true,
  };
}

/** Resolve product by public number (`1`) or internal cuid. */
export async function resolveProductId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (/^\d+$/.test(raw)) {
    const product = await prisma.product.findUnique({
      where: { number: Number(raw) },
    });
    if (!product) throw new NotFoundError("Product not found");
    return product.id;
  }
  return raw;
}

export async function listProducts(activeOnly = false) {
  const cache = activeOnly ? `${CATALOG_CACHE}:active` : CATALOG_CACHE;
  const cached = await cacheGet<unknown[]>(cache);
  if (cached) return cached;

  const products = await prisma.product.findMany({
    where: activeOnly ? { active: true, hidden: false } : undefined,
    include: {
      category: true,
      plans: {
        where: activeOnly ? { active: true } : undefined,
        orderBy: { price: "asc" },
      },
      upgrades: {
        include: {
          targetProduct: {
            select: { id: true, number: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });

  const ordered = activeOnly
    ? sortProductsByStartingPrice(products)
    : products;

  await cacheSet(cache, ordered, 30);
  return ordered;
}

export async function getProduct(idOrNumber: string | number) {
  const id = await resolveProductId(idOrNumber);
  const product = await prisma.product.findUnique({
    where: { id },
    include: productDetailInclude,
  });
  if (!product) throw new NotFoundError("Product not found");
  return product;
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      plans: { where: { active: true }, orderBy: { price: "asc" } },
      upgrades: {
        include: {
          targetProduct: {
            select: { id: true, number: true, name: true, slug: true },
          },
        },
      },
      configOptions: {
        where: { configOption: { hidden: false } },
        include: {
          configOption: {
            include: {
              choices: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!product || !product.active || product.hidden) {
    throw new NotFoundError("Product not found");
  }
  return {
    ...product,
    configOptions: product.configOptions
      .map((row) => row.configOption)
      .sort(compareConfigOptionOrder),
  };
}

export async function listFeaturedProducts() {
  const products = await prisma.product.findMany({
    where: { active: true, hidden: false, featured: true },
    include: {
      category: true,
      plans: { where: { active: true }, orderBy: { price: "asc" } },
      configOptions: {
        where: { configOption: { hidden: false } },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });
  return sortProductsByStartingPrice(
    products.map((p) => ({
      ...p,
      configOptionCount: p.configOptions.length,
    })),
  );
}

export async function createProduct(
  data: z.infer<typeof productCreateSchema>,
  actorId?: string,
) {
  const slug = slugify(data.slug || data.name);
  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      slug,
      active: data.active ?? true,
      hidden: data.hidden ?? false,
      stock: data.stock === undefined ? null : data.stock,
      perUserLimit: data.perUserLimit === undefined ? null : data.perUserLimit,
      allowQuantity: data.allowQuantity ?? "NO",
      categoryId: data.categoryId ?? null,
      imageUrl: data.imageUrl ?? null,
      featured: data.featured ?? false,
      sortOrder: data.sortOrder ?? 0,
      provisionProvider: data.provisionProvider ?? "noop",
      provisionConfig: (data.provisionConfig ?? {}) as object,
    },
    include: productDetailInclude,
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    metadata: { number: product.number },
  });
  return product;
}

export async function updateProduct(
  idOrNumber: string | number,
  data: Partial<z.infer<typeof productCreateSchema>>,
  actorId?: string,
) {
  return saveProduct(idOrNumber, data, actorId);
}

export async function saveProduct(
  idOrNumber: string | number,
  data: Partial<z.infer<typeof productSaveSchema>>,
  actorId?: string,
) {
  const id = await resolveProductId(idOrNumber);
  await getProduct(id);

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: data.name,
        description:
          data.description === undefined ? undefined : data.description,
        slug: data.slug === undefined ? undefined : slugify(data.slug),
        active: data.active,
        hidden: data.hidden,
        stock: data.stock === undefined ? undefined : data.stock,
        perUserLimit:
          data.perUserLimit === undefined ? undefined : data.perUserLimit,
        allowQuantity: data.allowQuantity,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId,
        imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl,
        featured: data.featured,
        sortOrder: data.sortOrder,
        provisionProvider: data.provisionProvider,
        provisionConfig:
          data.provisionConfig === undefined
            ? undefined
            : (data.provisionConfig as object),
      },
    });

    if (data.plans) {
      const existing = await tx.productPlan.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const keepIds = new Set(
        data.plans.map((p) => p.id).filter((v): v is string => Boolean(v)),
      );
      const toDelete = existing.filter((p) => !keepIds.has(p.id)).map((p) => p.id);

      if (toDelete.length > 0) {
        const used = await tx.orderItem.count({
          where: { planId: { in: toDelete } },
        });
        if (used > 0) {
          await tx.productPlan.updateMany({
            where: { id: { in: toDelete } },
            data: { active: false },
          });
        } else {
          await tx.service.deleteMany({ where: { planId: { in: toDelete } } });
          await tx.productPlan.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      for (const plan of data.plans) {
        const fields = normalizePlanFields(plan);
        if (plan.id && keepIds.has(plan.id)) {
          await tx.productPlan.update({
            where: { id: plan.id },
            data: fields,
          });
        } else {
          await tx.productPlan.create({
            data: { ...fields, productId: id },
          });
        }
      }
    }

    if (data.upgradeProductIds) {
      const targets = Array.from(new Set(data.upgradeProductIds)).filter(
        (targetId) => targetId !== id,
      );
      await tx.productUpgrade.deleteMany({ where: { productId: id } });
      if (targets.length > 0) {
        await tx.productUpgrade.createMany({
          data: targets.map((targetProductId) => ({
            productId: id,
            targetProductId,
          })),
        });
      }
    }

    return tx.product.findUniqueOrThrow({
      where: { id },
      include: productDetailInclude,
    });
  });

  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "product.update",
    entityType: "product",
    entityId: product.id,
  });
  return product;
}

export async function deleteProducts(
  idsOrNumbers: Array<string | number>,
  actorId?: string,
) {
  const ids: string[] = [];
  for (const value of idsOrNumbers) {
    ids.push(await resolveProductId(value));
  }
  if (ids.length === 0) return { count: 0 };

  const plans = await prisma.productPlan.findMany({
    where: { productId: { in: ids } },
    select: { id: true },
  });
  const planIds = plans.map((p) => p.id);
  if (planIds.length > 0) {
    await prisma.service.deleteMany({ where: { planId: { in: planIds } } });
    await prisma.orderItem.deleteMany({ where: { planId: { in: planIds } } });
  }

  const result = await prisma.product.deleteMany({
    where: { id: { in: ids } },
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "product.delete",
    entityType: "product",
    metadata: { ids },
  });
  return result;
}

export async function createPlan(
  data: z.infer<typeof planCreateSchema>,
  actorId?: string,
) {
  const productId = await resolveProductId(data.productId);
  await getProduct(productId);
  const fields = normalizePlanFields(data);
  const plan = await prisma.productPlan.create({
    data: { ...fields, productId },
  });
  await cacheDel(CATALOG_CACHE);
  await cacheDel(`${CATALOG_CACHE}:active`);
  await writeAuditLog({
    actorId,
    action: "plan.create",
    entityType: "product_plan",
    entityId: plan.id,
  });
  return plan;
}

export async function getPlan(id: string) {
  const plan = await prisma.productPlan.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!plan) throw new NotFoundError("Plan not found");
  return plan;
}

/** Validate quantity / stock / per-user limits for an orderable plan. */
export async function assertCanOrderPlan(input: {
  planId: string;
  clientId: string;
  quantity: number;
}) {
  const plan = await getPlan(input.planId);
  if (!plan.active || !plan.product.active || plan.product.hidden) {
    throw new ValidationError(`Plan ${plan.name} is not available`);
  }

  let quantity = input.quantity;
  if (plan.product.allowQuantity === "NO") {
    quantity = 1;
  }

  if (plan.product.stock != null) {
    const sold = await prisma.orderItem.aggregate({
      where: {
        plan: { productId: plan.productId },
        order: { status: { in: ["PENDING", "COMPLETED"] } },
      },
      _sum: { quantity: true },
    });
    const used = sold._sum.quantity ?? 0;
    if (used + quantity > plan.product.stock) {
      throw new ValidationError("Insufficient stock for this product");
    }
  }

  if (plan.product.perUserLimit != null) {
    const owned = await prisma.service.aggregate({
      where: {
        clientId: input.clientId,
        plan: { productId: plan.productId },
        status: { not: "TERMINATED" },
      },
      _sum: { quantity: true },
    });
    const count = owned._sum.quantity ?? 0;
    if (count + quantity > plan.product.perUserLimit) {
      throw new ValidationError("Per-user limit reached for this product");
    }
  }

  return { plan, quantity };
}
