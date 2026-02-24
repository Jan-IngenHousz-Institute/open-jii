/**
 * MSW server instance for Vitest.
 *
 * Automatically started/stopped/reset via `test/setup.ts`.
 *
 * Tests override endpoints with `server.mount()`:
 *
 * @example
 * ```ts
 * import { server } from "@/test/msw/server";
 * import { contract } from "@repo/api";
 * import { createExperiment } from "@/test/factories";
 *
 * // Return specific data
 * server.mount(contract.experiments.getExperiment, {
 *   body: createExperiment({ id: "exp-1", name: "Custom" }),
 * });
 *
 * // Error
 * server.mount(contract.experiments.getExperiment, { status: 404 });
 *
 * // Capture request body / params
 * const spy = server.mount(contract.macros.createMacro, {
 *   body: createMacro({ id: "new-1" }),
 * });
 * // … trigger action …
 * expect(spy.body).toMatchObject({ name: "Test" });
 *
 * // Delay (observe optimistic UI)
 * server.mount(contract.experiments.updateExperiment, {
 *   body: createExperiment({ id: "exp-1" }),
 *   delay: 100,
 * });
 * ```
 */
import { setupServer } from "msw/node";

import { handlers } from "./handlers";
import { createMount } from "./mount";

const _server = setupServer(...handlers);

/** MSW server extended with `mount()` for concise per-test overrides. */
export const server = Object.assign(_server, {
  mount: createMount(_server),
});
