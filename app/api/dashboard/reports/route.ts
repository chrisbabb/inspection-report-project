import { apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSellerReports } from "@/lib/services/reports";

function hasActiveSellerSubscription(status: string | null | undefined) {
  const normalized = status?.toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

export async function GET() {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const [sellerReports, purchasedReports] = await Promise.all([
      getSellerReports(authResult.appUser.id),
      db.reportAccess.findMany({
        where: {
          buyerUserId: authResult.appUser.id,
          status: "ACTIVE",
        },
        orderBy: {
          grantedAt: "desc",
        },
        select: {
          id: true,
          grantedAt: true,
          purchase: {
            select: {
              id: true,
              amountCents: true,
              purchasedAt: true,
            },
          },
          report: {
            select: {
              id: true,
              title: true,
              inspectionDate: true,
              priceCents: true,
              property: {
                select: {
                  formattedAddress: true,
                  city: true,
                  state: true,
                  zip: true,
                },
              },
              seller: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return apiSuccess({
      subscription: {
        status: authResult.appUser.subscriptionStatus ?? null,
        plan: authResult.appUser.subscriptionPlan ?? null,
        isActive: hasActiveSellerSubscription(authResult.appUser.subscriptionStatus),
      },
      sellerReports,
      purchasedReports: purchasedReports.map((entry) => ({
        accessId: entry.id,
        grantedAt: entry.grantedAt,
        purchase: entry.purchase,
        report: entry.report,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
