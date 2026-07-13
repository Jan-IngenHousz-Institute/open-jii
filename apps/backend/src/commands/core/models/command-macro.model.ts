import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { commandMacros } from "@repo/database";

// Schema for returning command-compatible macros
export const commandMacroSchema = createSelectSchema(commandMacros)
  .omit({ macroId: true })
  .extend({
    macro: z.object({
      id: z.string().uuid(),
      name: z.string(),
      filename: z.string(),
      language: z.enum(["python", "r", "javascript"]),
      createdBy: z.string().uuid(),
    }),
  });

// DTOs
export type CommandMacroDto = typeof commandMacroSchema._type;
