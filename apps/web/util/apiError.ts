import z from "zod";

const apiError = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export function parseApiError(error: unknown) {
  if (typeof error === "object" && error !== null && "body" in error) {
    return apiError.parse(error.body);
  }
  return undefined;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    return error.status as number;
  }
  return undefined;
}
