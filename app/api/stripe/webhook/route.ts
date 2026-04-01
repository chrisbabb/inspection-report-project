import Stripe from "stripe";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/services/billing";

export const runtime = "nodejs";

function getHeader(headers: Headers, key: string) {
  return headers.get(key) ?? headers.get(key.toLowerCase());
}

async function markWebhookFailed(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook error";

  await db.webhookEvent.update({
    where: { eventId },
    data: {
      status: "FAILED",
      error: message,
    },
  });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const type = session.metadata?.type;

  if (type === "report_purchase") {
    const purchaseId = session.metadata?.purchaseId;
    const reportId = session.metadata?.reportId;
    const buyerUserId = session.metadata?.buyerUserId;

    if (!purchaseId || !reportId || !buyerUserId) {
      throw new Error("Missing report purchase metadata on checkout session");
    }

    const existingPurchase = await db.purchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        status: true,
        reportId: true,
        buyerUserId: true,
      },
    });

    if (!existingPurchase) {
      throw new Error(`Purchase not found for purchaseId=${purchaseId}`);
    }

    if (existingPurchase.status === "SUCCEEDED") {
      return;
    }

    await db.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: "SUCCEEDED",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          purchasedAt: new Date(),
        },
      });

      await tx.reportAccess.upsert({
        where: {
          reportId_buyerUserId: {
            reportId,
            buyerUserId,
          },
        },
        update: {
          status: "ACTIVE",
          revokedAt: null,
        },
        create: {
          reportId,
          buyerUserId,
          purchaseId,
          status: "ACTIVE",
          grantedAt: new Date(),
        },
      });
    });

    return;
  }

  if (type === "seller_subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionFromStripe(subscription);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await syncSubscriptionFromStripe(subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await syncSubscriptionFromStripe(subscription);
}

export async function POST(req: Request) {
  const signature = getHeader(req.headers, "stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature header" },
      { status: 400 },
    );
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const payload = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await db.webhookEvent.findUnique({
    where: { eventId: event.id },
    select: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!existing) {
    await db.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        status: "RECEIVED",
        payloadJson: event as unknown as object,
      },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );

        await db.webhookEvent.update({
          where: { eventId: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            error: null,
          },
        });

        break;
      }

      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );

        await db.webhookEvent.update({
          where: { eventId: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            error: null,
          },
        });

        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );

        await db.webhookEvent.update({
          where: { eventId: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            error: null,
          },
        });

        break;
      }

      default: {
        await db.webhookEvent.update({
          where: { eventId: event.id },
          data: {
            status: "IGNORED",
            processedAt: new Date(),
            error: null,
          },
        });

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    await markWebhookFailed(event.id, error);

    const message =
      error instanceof Error ? error.message : "Webhook processing failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}