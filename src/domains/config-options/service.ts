import { z } from "zod";
import { prisma } from "@/src/db/client";
import { NotFoundError, ValidationError } from "@/src/core/errors";
import { writeAuditLog } from "@/src/domains/audit/service";
import type { BillingPeriod, PlanType } from "@/src/generated/prisma/client";
import { compareConfigOptionOrder } from "@/src/domains/config-options/order";

const TYPES_WITH_CHOICES = new Set([
  "SELECT",
  "RADIO",
  "CHECKBOX",
  "SLIDER",
]);

export const configOptionChoiceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  envKey: z.string().min(1),
  sortOrder: z.number().int().optional(),
  pricingName: z.string().min(1),
  pricingType: z.enum(["FREE", "ONE_TIME", "RECURRING"]).default("FREE"),
  price: z.number().int().nonnegative().default(0),
  intervalCount: z.number().int().positive().default(1),
  billingPeriod: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).default("MONTH"),
});

export const configOptionSaveSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  envKey: z.string().min(1),
  type: z.enum(["TEXT", "NUMBER", "SELECT", "RADIO", "CHECKBOX", "SLIDER"]),
  hidden: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  productIds: z.array(z.string()).optional(),
  options: z.array(configOptionChoiceSchema).optional(),
});

function requireChoicesForType(
  type: string,
  options: Array<unknown> | undefined,
) {
  if (TYPES_WITH_CHOICES.has(type) && (!options || options.length < 1)) {
    throw new ValidationError(
      "At least one option is required for Select, Radio, Checkbox, and Slider types",
    );
  }
}

const detailInclude = {
  products: {
    include: {
      product: {
        select: { id: true, number: true, name: true, slug: true },
      },
    },
  },
  choices: { orderBy: { sortOrder: "asc" as const } },
};

function normalizeChoiceFields(
  data: z.infer<typeof configOptionChoiceSchema>,
  sortOrder: number,
) {
  const pricingType = data.pricingType as PlanType;
  const price = pricingType === "FREE" ? 0 : data.price;
  const intervalCount =
    pricingType === "RECURRING" ? data.intervalCount : 1;
  const billingPeriod = (
    pricingType === "RECURRING" ? data.billingPeriod : "MONTH"
  ) as BillingPeriod;

  return {
    name: data.name,
    envKey: data.envKey,
    sortOrder: data.sortOrder ?? sortOrder,
    pricingName: data.pricingName,
    pricingType,
    price,
    intervalCount,
    billingPeriod,
  };
}

/** Resolve config option by public number (`1`) or internal cuid. */
export async function resolveConfigOptionId(idOrNumber: string | number) {
  const raw = String(idOrNumber);
  if (/^\d+$/.test(raw)) {
    const option = await prisma.configOption.findUnique({
      where: { number: Number(raw) },
    });
    if (!option) throw new NotFoundError("Config option not found");
    return option.id;
  }
  return raw;
}

export async function listConfigOptions() {
  const rows = await prisma.configOption.findMany({
    include: {
      _count: { select: { products: true, choices: true } },
    },
  });
  return rows.sort(compareConfigOptionOrder);
}

export async function getConfigOption(idOrNumber: string | number) {
  const id = await resolveConfigOptionId(idOrNumber);
  const option = await prisma.configOption.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!option) throw new NotFoundError("Config option not found");
  return {
    ...option,
    productIds: option.products.map((p) => p.productId),
    options: option.choices,
  };
}

export async function createConfigOption(
  data: z.infer<typeof configOptionSaveSchema>,
  actorId?: string,
) {
  requireChoicesForType(data.type, data.options ?? []);

  const option = await prisma.$transaction(async (tx) => {
    const created = await tx.configOption.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        envKey: data.envKey,
        type: data.type,
        hidden: data.hidden ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    await syncProducts(tx, created.id, data.productIds ?? []);
    await syncChoices(tx, created.id, data.type, data.options ?? []);

    return tx.configOption.findUniqueOrThrow({
      where: { id: created.id },
      include: detailInclude,
    });
  });

  await writeAuditLog({
    actorId,
    action: "config_option.create",
    entityType: "config_option",
    entityId: option.id,
    metadata: { number: option.number },
  });

  return {
    ...option,
    productIds: option.products.map((p) => p.productId),
    options: option.choices,
  };
}

export async function updateConfigOption(
  idOrNumber: string | number,
  data: Partial<z.infer<typeof configOptionSaveSchema>>,
  actorId?: string,
) {
  const id = await resolveConfigOptionId(idOrNumber);
  const existing = await prisma.configOption.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Config option not found");

  const type = data.type ?? existing.type;
  if (TYPES_WITH_CHOICES.has(type)) {
    if (data.options !== undefined) {
      requireChoicesForType(type, data.options);
    } else if (data.type !== undefined) {
      // Type change without options would clear choices via sync
      requireChoicesForType(type, []);
    }
  }

  const option = await prisma.$transaction(async (tx) => {
    await tx.configOption.update({
      where: { id },
      data: {
        name: data.name,
        description:
          data.description === undefined ? undefined : data.description,
        envKey: data.envKey,
        type: data.type,
        hidden: data.hidden,
        sortOrder: data.sortOrder,
      },
    });

    if (data.productIds) {
      await syncProducts(tx, id, data.productIds);
    }
    if (data.options !== undefined || data.type !== undefined) {
      await syncChoices(tx, id, type, data.options ?? []);
    }

    return tx.configOption.findUniqueOrThrow({
      where: { id },
      include: detailInclude,
    });
  });

  await writeAuditLog({
    actorId,
    action: "config_option.update",
    entityType: "config_option",
    entityId: option.id,
    metadata: { number: option.number },
  });

  return {
    ...option,
    productIds: option.products.map((p) => p.productId),
    options: option.choices,
  };
}

export async function deleteConfigOptions(
  idsOrNumbers: Array<string | number>,
  actorId?: string,
) {
  const ids = await Promise.all(idsOrNumbers.map(resolveConfigOptionId));
  await prisma.configOption.deleteMany({ where: { id: { in: ids } } });
  await writeAuditLog({
    actorId,
    action: "config_option.delete",
    entityType: "config_option",
    entityId: ids.join(","),
    metadata: { count: ids.length },
  });
  return { deleted: ids.length };
}

async function syncProducts(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  configOptionId: string,
  productIds: string[],
) {
  const unique = Array.from(new Set(productIds));
  await tx.configOptionProduct.deleteMany({ where: { configOptionId } });
  if (unique.length > 0) {
    await tx.configOptionProduct.createMany({
      data: unique.map((productId) => ({ configOptionId, productId })),
    });
  }
}

async function syncChoices(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  configOptionId: string,
  type: string,
  options: z.infer<typeof configOptionChoiceSchema>[],
) {
  if (!TYPES_WITH_CHOICES.has(type)) {
    await tx.configOptionChoice.deleteMany({ where: { configOptionId } });
    return;
  }

  const existing = await tx.configOptionChoice.findMany({
    where: { configOptionId },
    select: { id: true },
  });
  const keepIds = new Set(
    options.map((o) => o.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = existing.filter((row) => !keepIds.has(row.id)).map((r) => r.id);
  if (toDelete.length > 0) {
    await tx.configOptionChoice.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  for (let i = 0; i < options.length; i++) {
    const fields = normalizeChoiceFields(options[i], i);
    const optionId = options[i].id;
    if (optionId && keepIds.has(optionId)) {
      await tx.configOptionChoice.update({
        where: { id: optionId },
        data: fields,
      });
    } else {
      await tx.configOptionChoice.create({
        data: { configOptionId, ...fields },
      });
    }
  }
}
