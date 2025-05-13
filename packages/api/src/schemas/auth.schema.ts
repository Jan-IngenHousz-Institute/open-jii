import z from "zod";

// Zod schemas for Auth.js core types
export const zUserAuthSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

export const zDefaultSessionAuthSchema = z.object({
  user: zUserAuthSchema.optional(),
  expires: z.string(), // ISODateString
});

export const zSessionAuthSchema = zDefaultSessionAuthSchema;

export const zCsrfAuthSchema = z.object({ csrfToken: z.string() });
export const zHtmlAuthSchema = z.string();
export const zUrlAuthSchema = z.object({ url: z.string() });
export const zProvidersAuthSchema = z.record(z.any());
