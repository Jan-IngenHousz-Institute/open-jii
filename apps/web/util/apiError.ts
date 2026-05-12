import z from "zod";

const apiError = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export function parseApiError(error: unknown) {
  if (typeof error === "object" && error !== null && "body" in error) {
    const result = apiError.safeParse(error.body);
    if (result.success) return result.data;
  }
  return undefined;
}
