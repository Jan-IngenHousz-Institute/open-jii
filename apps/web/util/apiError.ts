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
