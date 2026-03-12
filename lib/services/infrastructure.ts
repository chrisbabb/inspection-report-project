import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { s3 } from "@/lib/s3";

export async function checkDatabase() {
  await db.$queryRaw`SELECT 1`;
  return true;
}

export async function checkRedis() {
  const client = await getRedis();
  await client.ping();
  return true;
}

export async function checkStorage() {
  await s3.send(new ListBucketsCommand({}));
  return true;
}