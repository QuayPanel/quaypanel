import "dotenv/config";
import { prisma } from "../src/db/client";
import { env } from "../src/core/env";
import { auth } from "../src/auth/auth";
import { logger } from "../src/core/logger";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: env.ADMIN_EMAIL },
  });

  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
        name: env.ADMIN_NAME,
      },
    });

    const client = await prisma.client.create({
      data: {
        name: env.ADMIN_NAME,
        email: env.ADMIN_EMAIL,
      },
    });

    await prisma.user.update({
      where: { email: env.ADMIN_EMAIL },
      data: { role: "ADMIN", clientId: client.id },
    });

    logger.info({ email: env.ADMIN_EMAIL }, "Seeded admin user");
  } else {
    let clientId = existing.clientId;
    if (!clientId) {
      const client =
        (await prisma.client.findFirst({
          where: { email: env.ADMIN_EMAIL },
        })) ??
        (await prisma.client.create({
          data: {
            name: existing.name || env.ADMIN_NAME,
            email: env.ADMIN_EMAIL,
          },
        }));
      clientId = client.id;
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          clientId,
        },
      });
      logger.info(
        { email: env.ADMIN_EMAIL },
        "Linked client account to admin user",
      );
    } else if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN" },
      });
      logger.info({ email: env.ADMIN_EMAIL }, "Promoted existing user to ADMIN");
    } else {
      logger.info({ email: env.ADMIN_EMAIL }, "Admin already exists");
    }
  }

  const defaults: Array<{ key: string; value: unknown }> = [
    { key: "brand.name", value: env.DEFAULT_BRAND_NAME },
    { key: "currency", value: env.DEFAULT_CURRENCY },
    { key: "smtp.host", value: env.SMTP_HOST },
    { key: "smtp.port", value: env.SMTP_PORT },
    { key: "smtp.user", value: env.SMTP_USER },
    { key: "smtp.from", value: env.SMTP_FROM },
    { key: "smtp.pass", value: env.SMTP_PASS },
    { key: "tax.enabled", value: false },
    { key: "tax.rate", value: 0 },
    { key: "tax.type", value: "exclusive" },
    { key: "cron.suspendOverdueDays", value: 2 },
    { key: "cron.time", value: "00:00" },
    { key: "tickets.enabled", value: true },
    { key: "provisioning.pterodactyl", value: { enabled: false, baseUrl: "", apiKey: "" } },
    { key: "affiliates.defaultCommission", value: 10 },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value as object },
      update: {},
    });
  }

  await prisma.gatewayConfig.upsert({
    where: { gatewayId: "stripe" },
    create: {
      gatewayId: "stripe",
      enabled: Boolean(env.STRIPE_SECRET_KEY),
      config: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      },
    },
    update: {},
  });

  await prisma.gatewayConfig.upsert({
    where: { gatewayId: "paypal" },
    create: {
      gatewayId: "paypal",
      enabled: Boolean(env.PAYPAL_CLIENT_ID),
      config: {
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        mode: env.PAYPAL_MODE,
      },
    },
    update: {},
  });

  await prisma.pluginInstall.upsert({
    where: { pluginId: "payments.stripe" },
    create: { pluginId: "payments.stripe", enabled: true, config: {} },
    update: {},
  });

  await prisma.pluginInstall.upsert({
    where: { pluginId: "payments.paypal" },
    create: { pluginId: "payments.paypal", enabled: true, config: {} },
    update: {},
  });

  await prisma.pluginInstall.upsert({
    where: { pluginId: "provisioning.noop" },
    create: { pluginId: "provisioning.noop", enabled: true, config: {} },
    update: {},
  });

  await prisma.pluginInstall.upsert({
    where: { pluginId: "provisioning.pterodactyl" },
    create: { pluginId: "provisioning.pterodactyl", enabled: true, config: {} },
    update: {},
  });

  await prisma.pluginInstall.upsert({
    where: { pluginId: "provisioning.proxmox" },
    create: { pluginId: "provisioning.proxmox", enabled: true, config: {} },
    update: {},
  });

  const gaming = await prisma.category.upsert({
    where: { slug: "game-servers" },
    create: {
      name: "Game Servers",
      slug: "game-servers",
      description: "Minecraft and game hosting plans",
      sortOrder: 1,
      active: true,
    },
    update: {},
  });

  const vps = await prisma.category.upsert({
    where: { slug: "vps" },
    create: {
      name: "VPS",
      slug: "vps",
      description: "Virtual private servers",
      sortOrder: 2,
      active: true,
    },
    update: {},
  });

  const minecraft = await prisma.product.upsert({
    where: { slug: "minecraft" },
    create: {
      name: "Minecraft",
      slug: "minecraft",
      description: "Managed Minecraft game servers",
      categoryId: gaming.id,
      featured: true,
      sortOrder: 1,
      provisionProvider: "noop",
      provisionConfig: {},
      active: true,
    },
    update: {},
  });

  const existingPlans = await prisma.productPlan.count({
    where: { productId: minecraft.id },
  });
  if (existingPlans === 0) {
    await prisma.productPlan.createMany({
      data: [
        {
          productId: minecraft.id,
          name: "Starter",
          price: 999,
          currency: "USD",
          interval: "month",
          active: true,
        },
        {
          productId: minecraft.id,
          name: "Pro",
          price: 1999,
          currency: "USD",
          interval: "month",
          active: true,
        },
      ],
    });
  }

  await prisma.product.upsert({
    where: { slug: "cloud-vps" },
    create: {
      name: "Cloud VPS",
      slug: "cloud-vps",
      description: "General purpose VPS",
      categoryId: vps.id,
      featured: true,
      sortOrder: 1,
      provisionProvider: "noop",
      active: true,
    },
    update: {},
  });

  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    create: {
      code: "WELCOME10",
      type: "PERCENT",
      value: 10,
      active: true,
    },
    update: {},
  });

  logger.info("Seed complete");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
