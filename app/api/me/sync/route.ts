import { auth } from "@clerk/nextjs/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { syncClerkUserToDb } from "@/lib/services/users";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const user = await syncClerkUserToDb(userId);

    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}