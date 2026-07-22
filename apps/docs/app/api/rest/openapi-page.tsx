"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";

// Playground disabled: API CORS does not allow a docs origin (apps/backend/src/main.ts).
export const OpenAPIPage = createOpenAPIPage({
  playground: { enabled: false },
});
