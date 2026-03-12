import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Run middleware on all routes except Next internals and static files
    "/((?!_next|.*\\..*).*)",
  ],
};