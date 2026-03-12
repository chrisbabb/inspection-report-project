import { clerkClient } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

function getPrimaryEmailAddress(user: {
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
  }>;
  primaryEmailAddressId: string | null;
}) {
  const primary =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];

  return primary?.emailAddress ?? null;
}

export async function syncClerkUserToDb(clerkUserId: string) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);

  const email = getPrimaryEmailAddress(clerkUser);

  if (!email) {
    throw new Error("Authenticated Clerk user does not have an email address");
  }

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    null;

  const phone =
    clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId)
      ?.phoneNumber ??
    clerkUser.phoneNumbers[0]?.phoneNumber ??
    null;

  return db.user.upsert({
    where: {
      clerkUserId,
    },
    update: {
      email,
      name: fullName,
      phone,
    },
    create: {
      clerkUserId,
      email,
      name: fullName,
      phone,
      role: UserRole.USER,
    },
  });
}

export async function getAppUserByClerkUserId(clerkUserId: string) {
  return db.user.findUnique({
    where: {
      clerkUserId,
    },
  });
}