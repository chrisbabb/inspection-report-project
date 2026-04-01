import Stripe from "stripe";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __stripe__: Stripe | undefined;
}

export const stripe =
  global.__stripe__ ??
  new Stripe(env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2026-02-25.clover",
  });

if (env.NODE_ENV !== "production") {
  global.__stripe__ = stripe;
}

export function isStripeConfigured() {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      env.STRIPE_MONTHLY_PRICE_ID &&
      env.STRIPE_ANNUAL_PRICE_ID,
  );
}

export function requireStripeConfigured() {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not fully configured. Check STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_MONTHLY_PRICE_ID, and STRIPE_ANNUAL_PRICE_ID.",
    );
  }
}

export function getStripeBaseUrl() {
  return env.PLATFORM_BASE_URL ?? env.APP_URL;
}