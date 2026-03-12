import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED";

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    { ok: true, data },
    { status: init?.status ?? 200, ...init },
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json<ApiErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request data", 400, error.flatten());
  }

  if (error instanceof Error) {
    return apiError("INTERNAL_ERROR", error.message || "Internal server error", 500);
  }

  return apiError("INTERNAL_ERROR", "Internal server error", 500);
}