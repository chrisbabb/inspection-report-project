import { apiSuccess } from "@/lib/api";
import {
  checkDatabase,
  checkRedis,
  checkStorage,
} from "@/lib/services/infrastructure";

export async function GET() {
  const result = {
    status: "ok" as "ok" | "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      database: "ok" as "ok" | "error",
      redis: "ok" as "ok" | "error",
      storage: "ok" as "ok" | "error",
    },
  };

  try {
    await checkDatabase();
  } catch (error) {
    console.error("Database readiness check failed:", error);
    result.status = "degraded";
    result.checks.database = "error";
  }

  try {
    await checkRedis();
  } catch (error) {
    console.error("Redis readiness check failed:", error);
    result.status = "degraded";
    result.checks.redis = "error";
  }

  try {
    await checkStorage();
  } catch (error) {
    console.error("Storage readiness check failed:", error);
    result.status = "degraded";
    result.checks.storage = "error";
  }

  const statusCode = result.status === "ok" ? 200 : 503;

  return apiSuccess(result, { status: statusCode });
}