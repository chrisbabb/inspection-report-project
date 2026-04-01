import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const globalForS3 = globalThis as unknown as {
  s3?: S3Client;
};

export const s3 =
  globalForS3.s3 ??
  new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3 = s3;
}

export const S3_BUCKET = env.S3_BUCKET;

export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });

  return getSignedUrl(s3, command, {
    expiresIn: params.expiresIn ?? 300,
  });
}

export async function createPresignedDownloadUrl(params: {
  key: string;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: params.expiresIn ?? env.PDF_SIGNED_URL_TTL_SECONDS ?? 120,
  });
}