/**
 * MSW server instance for Vitest.
 *
 * Import and use this in tests that need to intercept HTTP requests.
 * The server is automatically started/stopped/reset via the global
 * test setup in `test/setup.ts`.
 *
 * For per-test overrides, use `server.use(...)` within individual tests.
 *
 * @example
 * ```ts
 * import { server } from "@/test/msw/server";
 * import { http, HttpResponse } from "msw";
 *
 * it("handles an error", async () => {
 *   server.use(
 *     http.get("http://localhost:3020/api/v1/experiments", () => {
 *       return HttpResponse.json({ message: "Internal Server Error" }, { status: 500 });
 *     }),
 *   );
 *   // ... rest of test
 * });
 * ```
 */
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

export const server = setupServer(...handlers);
