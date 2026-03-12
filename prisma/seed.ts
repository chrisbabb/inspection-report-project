import { PrismaClient, UserRole } from "@prisma/client";
import {
  DEFAULT_REPORT_PURCHASE_PRICE_CENTS,
  DEFAULT_SELLER_ANNUAL_PRICE_CENTS,
  DEFAULT_SELLER_MONTHLY_PRICE_CENTS,
} from "../lib/constants/app";

const prisma = new PrismaClient();

async function upsertAppSetting(params: {
  key: string;
  valueJson: unknown;
  description?: string;
}) {
  return prisma.appSetting.upsert({
    where: { key: params.key },
    update: {
      valueJson: params.valueJson as object,
      description: params.description,
    },
    create: {
      key: params.key,
      valueJson: params.valueJson as object,
      description: params.description,
    },
  });
}

async function seedAppSettings() {
  await upsertAppSetting({
    key: "report_purchase_price",
    valueJson: { cents: DEFAULT_REPORT_PURCHASE_PRICE_CENTS },
    description: "Default buyer purchase price for a report in cents.",
  });

  await upsertAppSetting({
    key: "seller_subscription_monthly_price",
    valueJson: { cents: DEFAULT_SELLER_MONTHLY_PRICE_CENTS },
    description: "Default monthly seller subscription price in cents.",
  });

  await upsertAppSetting({
    key: "seller_subscription_annual_price",
    valueJson: { cents: DEFAULT_SELLER_ANNUAL_PRICE_CENTS },
    description: "Default annual seller subscription price in cents.",
  });

  await upsertAppSetting({
    key: "pdf_signed_url_ttl_seconds",
    valueJson: { seconds: 120 },
    description: "Signed URL lifetime for secure PDF viewing.",
  });
}

async function seedLocalAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminClerkUserId = process.env.SEED_ADMIN_CLERK_USER_ID;

  if (!adminEmail || !adminClerkUserId) {
    console.log(
      "Skipping local admin seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_CLERK_USER_ID to enable it.",
    );
    return;
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      clerkUserId: adminClerkUserId,
      role: UserRole.ADMIN,
    },
    create: {
      email: adminEmail,
      clerkUserId: adminClerkUserId,
      role: UserRole.ADMIN,
      name: "Local Admin",
    },
  });

  console.log(`Seeded local admin user: ${adminEmail}`);
}

async function main() {
  console.log("Seeding app settings...");
  await seedAppSettings();

  console.log("Seeding local admin (optional)...");
  await seedLocalAdmin();

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });