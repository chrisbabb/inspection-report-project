"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function HomeClient() {
  const { isSignedIn } = useAuth();

  return (
    <main style={{ padding: 24 }}>
      <h1>Inspection Report Marketplace</h1>

      {!isSignedIn ? (
        <SignInButton />
      ) : (
        <>
          <p>You are signed in.</p>
          <UserButton />
        </>
      )}
    </main>
  );
}