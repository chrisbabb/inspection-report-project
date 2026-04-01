import { prisma } from "@/lib/db";
import { stripe, requireStripeConfigured, getStripeBaseUrl } from "@/lib/stripe";
import { env } from "@/lib/env";
import { ensureStripeCustomerForUser } from "@/lib/services/billing";
import { ReportStatus } from "@prisma/client";

export type VerifyReportPurchasabilityInput = {
  reportId: string;
  buyerUserId: string;
};

export type VerifyReportPurchasabilityResult = {
  ok: true;
  reportId: string;
  sellerUserId: string;
  amountCents: number;
  platformFeeCents: number;
  sellerPayoutCents: number;
};

export type CreateReportCheckoutSessionInput = {
  reportId: string;
  buyerUserId: string;
};

export type CreateReportCheckoutSessionResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
};

function getMoneyConfig() {
  const amountCents = 5000;
  const platformFeeCents = 1000;
  const sellerPayoutCents = amountCents - platformFeeCents;

  return {
    amountCents,
    platformFeeCents,
    sellerPayoutCents,
  };
}

export async function verifyReportPurchasability(
  input: VerifyReportPurchasabilityInput,
): Promise<VerifyReportPurchasabilityResult> {
  const report = await prisma.report.findUnique({
    where: { id: input.reportId },
    select: {
      id: true,
      sellerUserId: true,
      status: true,
      title: true,
      property: {
        select: {
          formattedAddress: true,
        },
      },
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  if (report.status !== ReportStatus.PUBLISHED) {
    throw new Error("This report is not available for purchase");
  }

  if (report.sellerUserId === input.buyerUserId) {
    throw new Error("Sellers cannot purchase their own reports");
  }

  const existingAccess = await prisma.reportAccess.findUnique({
    where: {
      reportId_buyerUserId: {
        reportId: input.reportId,
        buyerUserId: input.buyerUserId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingAccess?.status === "ACTIVE") {
    throw new Error("You already have access to this report");
  }

  const existingPendingOrCompletedPurchase = await prisma.purchase.findFirst({
    where: {
      reportId: input.reportId,
      buyerUserId: input.buyerUserId,
      status: {
        in: ["PENDING", "SUCCEEDED"],
      },
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingPendingOrCompletedPurchase?.status === "PENDING") {
    throw new Error("A purchase is already in progress for this report");
  }

  if (existingPendingOrCompletedPurchase?.status === "SUCCEEDED") {
    throw new Error("You already purchased this report");
  }

  const money = getMoneyConfig();

  return {
    ok: true,
    reportId: report.id,
    sellerUserId: report.sellerUserId,
    amountCents: money.amountCents,
    platformFeeCents: money.platformFeeCents,
    sellerPayoutCents: money.sellerPayoutCents,
  };
}

export async function createReportCheckoutSession(
  input: CreateReportCheckoutSessionInput,
): Promise<CreateReportCheckoutSessionResult> {
  requireStripeConfigured();

  const report = await prisma.report.findUnique({
    where: { id: input.reportId },
    select: {
      id: true,
      title: true,
      sellerUserId: true,
      property: {
        select: {
          formattedAddress: true,
        },
      },
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  const purchasability = await verifyReportPurchasability(input);
  const { stripeCustomerId } = await ensureStripeCustomerForUser(input.buyerUserId);

  const pendingPurchase = await prisma.purchase.create({
    data: {
      reportId: report.id,
      buyerUserId: input.buyerUserId,
      status: "PENDING",
      amountCents: purchasability.amountCents,
      platformFeeCents: purchasability.platformFeeCents,
      sellerPayoutCents: purchasability.sellerPayoutCents,
    },
    select: {
      id: true,
    },
  });

  const title =
    report.title?.trim() ||
    `Home inspection report - ${report.property.formattedAddress}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    success_url: `${getStripeBaseUrl()}/report/${report.id}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getStripeBaseUrl()}/report/${report.id}?purchase=cancelled`,
    payment_method_types: ["card"],
    line_items: env.STRIPE_REPORT_PRICE_ID
      ? [
          {
            price: env.STRIPE_REPORT_PRICE_ID,
            quantity: 1,
          },
        ]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: title,
                description: report.property.formattedAddress,
              },
              unit_amount: purchasability.amountCents,
            },
            quantity: 1,
          },
        ],
    metadata: {
      type: "report_purchase",
      purchaseId: pendingPurchase.id,
      reportId: report.id,
      buyerUserId: input.buyerUserId,
      sellerUserId: report.sellerUserId,
      amountCents: String(purchasability.amountCents),
      platformFeeCents: String(purchasability.platformFeeCents),
      sellerPayoutCents: String(purchasability.sellerPayoutCents),
    },
  });

  await prisma.purchase.update({
    where: { id: pendingPurchase.id },
    data: {
      stripeCheckoutSessionId: session.id,
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