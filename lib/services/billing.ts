import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe, requireStripeConfigured, getStripeBaseUrl } from "@/lib/stripe";
import { env } from "@/lib/env";

export type SellerBillingInterval = "monthly" | "annual";

export type EnsureStripeCustomerResult = {
  userId: string;
  stripeCustomerId: string;
};

export type CreateSubscriptionCheckoutSessionInput = {
  userId: string;
  userEmail: string;
  interval: SellerBillingInterval;
};

export type CreateSubscriptionCheckoutSessionResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
};

export type CreateBillingPortalSessionInput = {
  userId: string;
};

export type CreateBillingPortalSessionResult = {
  url: string;
};

export type SubscriptionSyncResult = {
  userId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

function getSubscriptionPriceId(interval: SellerBillingInterval) {
  if (interval === "monthly") {
    return env.STRIPE_MONTHLY_PRICE_ID!;
  }

  return env.STRIPE_ANNUAL_PRICE_ID!;
}

function toDateFromUnix(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

async function createStripeCustomer(params: {
  email: string;
  name?: string | null;
  metadata?: Record<string, string>;
}) {
  return stripe.customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: params.metadata,
  });
}

export async function ensureStripeCustomerForUser(
  userId: string,
): Promise<EnsureStripeCustomerResult> {
  requireStripeConfigured();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.stripeCustomerId) {
    return {
      userId: user.id,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  const customer = await createStripeCustomer({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return {
    userId: user.id,
    stripeCustomerId: customer.id,
  };
}

export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutSessionInput,
): Promise<CreateSubscriptionCheckoutSessionResult> {
  requireStripeConfigured();

  const priceId = getSubscriptionPriceId(input.interval);
  const { stripeCustomerId } = await ensureStripeCustomerForUser(input.userId);

  const baseUrl = getStripeBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    customer_update: {
      address: "auto",
      name: "auto",
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard/reports?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/reports?billing=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      type: "seller_subscription",
      userId: input.userId,
      interval: input.interval,
    },
    subscription_data: {
      metadata: {
        type: "seller_subscription",
        userId: input.userId,
        interval: input.interval,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout session did not return a URL");
  }

  return {
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
  };
}

export async function createBillingPortalSession(
  input: CreateBillingPortalSessionInput,
): Promise<CreateBillingPortalSessionResult> {
  requireStripeConfigured();

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      stripeCustomerId: true,
    },
  });

  if (!user?.stripeCustomerId) {
    throw new Error("User does not have a Stripe customer ID");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getStripeBaseUrl()}/dashboard/reports`,
  });

  return {
    url: session.url,
  };
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<SubscriptionSyncResult> {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const user = stripeCustomerId
    ? await prisma.user.findFirst({
        where: { stripeCustomerId },
        select: { id: true },
      })
    : null;

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;

  const result: SubscriptionSyncResult = {
    userId: user?.id ?? null,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId,
    currentPeriodStart: toDateFromUnix(
      (subscription as Stripe.Subscription & {
        current_period_start?: number;
      }).current_period_start,
    ),
    currentPeriodEnd: toDateFromUnix(
      (subscription as Stripe.Subscription & {
        current_period_end?: number;
      }).current_period_end,
    ),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };

  if (!user?.id) {
    return result;
  }

  const derivedPlan =
    priceId === env.STRIPE_MONTHLY_PRICE_ID
      ? "monthly"
      : priceId === env.STRIPE_ANNUAL_PRICE_ID
        ? "annual"
        : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: subscription.status,
      subscriptionPlan: derivedPlan,
    },
  });

  return result;
}