import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { commandMacros } from "@repo/database";

// Schema for returning macro-compatible commands
export const macroCommandSchema = createSelectSchema(commandMacros)
  .omit({ commandId: true })
  .extend({
    command: z.object({
      id: z.string().uuid(),
      name: z.string(),
      family: z.string(),
      createdBy: z.string().uuid(),
    }),
  });

// DTOs
export type MacroCommandDto = typeof macroCommandSchema._type;
