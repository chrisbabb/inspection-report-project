import { auth } from "@clerk/nextjs/server";
import { apiError } from "@/lib/api";
import { syncClerkUserToDb } from "@/lib/services/users";

export async function requireAppUser() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: apiError("UNAUTHORIZED", "Authentication required", 401),
    };
  }

  const appUser = await syncClerkUserToDb(userId);

  return {
    ok: true as const,
    userId,
    appUser,
  };
}