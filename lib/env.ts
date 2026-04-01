import { z } from "zod";

const booleanFromString = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === "true";
  });

const positiveIntFromString = (key: string, fallback?: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === "") {
        if (fallback !== undefined) return fallback;
        return undefined;
      }

      const parsed = Number(value);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${key} must be a positive integer`);
      }

      return parsed;
    });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.string().default("local"),
  APP_URL: z.url().default("http://localhost:3000"),
  PLATFORM_BASE_URL: z.url().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
  S3_FORCE_PATH_STYLE: booleanFromString.transform((value) => value ?? true),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),

  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required"),

  PDF_SIGNED_URL_TTL_SECONDS: positiveIntFromString(
    "PDF_SIGNED_URL_TTL_SECONDS",
    120,
  ),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_ANNUAL_PRICE_ID: z.string().optional(),
  STRIPE_REPORT_PRICE_ID: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:\n",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

const envData = parsedEnv.data;

const resolvedPlatformBaseUrl = envData.PLATFORM_BASE_URL ?? envData.APP_URL;

const hasAnyStripeEnv =
  Boolean(envData.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
  Boolean(envData.STRIPE_SECRET_KEY) ||
  Boolean(envData.STRIPE_WEBHOOK_SECRET) ||
  Boolean(envData.STRIPE_MONTHLY_PRICE_ID) ||
  Boolean(envData.STRIPE_ANNUAL_PRICE_ID) ||
  Boolean(envData.STRIPE_REPORT_PRICE_ID);

if (hasAnyStripeEnv) {
  const requiredWhenStripeEnabled = [
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_MONTHLY_PRICE_ID",
    "STRIPE_ANNUAL_PRICE_ID",
  ] as const;

  const missing = requiredWhenStripeEnabled.filter((key) => !envData[key]);

  if (missing.length > 0) {
    throw new Error(
      `Stripe is partially configured. Missing required env vars: ${missing.join(", ")}`,
    );
  }
}

export const env = {
  ...envData,
  PLATFORM_BASE_URL: resolvedPlatformBaseUrl,
};