"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export default function HomeClient() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Inspection Report Marketplace</h1>

      <SignedOut>
        <SignInButton />
      </SignedOut>

      <SignedIn>
        <p>You are signed in.</p>
        <UserButton />
      </SignedIn>
    </main>
  );
}