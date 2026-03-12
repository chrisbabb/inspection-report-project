import { apiSuccess, handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/authz";
import { getSellerReports } from "@/lib/services/reports";

export async function GET() {
  try {
    const authResult = await requireAppUser();

    if (!authResult.ok) {
      return authResult.response;
    }

    const reports = await getSellerReports(authResult.appUser.id);

    return apiSuccess(reports);
  } catch (error) {
    return handleApiError(error);
  }
}