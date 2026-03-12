import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  // Postgres check
  const userCount = await db.user.count();

  // Redis check
  await redis.set("healthcheck", "ok", "EX", 30);
  const redisValue = await redis.get("healthcheck");

  return NextResponse.json({
    ok: true,
    postgres: { userCount },
    redis: { healthcheck: redisValue },
  });
}