import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Roboto } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Inspection Report Marketplace",
  description: "Buy and sell home inspection reports.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${roboto.className} min-h-screen overflow-x-hidden`}>
          <header className="site-header h-[72px] border-b">
            <div className="mx-auto flex h-full w-full items-center justify-between px-5">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                Inspection Report Marketplace
              </Link>

              <div className="flex items-center gap-3">
                <ThemeToggle />

                {userId ? (
                  <>
                    <Link href="/dashboard/reports" className="site-nav-link text-sm font-medium">
                      Dashboard
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                  </>
                ) : (
                  <>
                    <Link href="/sign-in" className="site-nav-link text-sm font-medium">
                      Sign In
                    </Link>
                    <Link href="/sign-up" className="app-button-primary px-4 py-2 text-sm">
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="min-h-[calc(100vh-72px)]">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
