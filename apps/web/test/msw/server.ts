import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { handlers } from "./handlers";
import { createMount } from "./mount";

const _server = setupServer(...handlers);

export const server = Object.assign(_server, {
  mount: createMount(_server),
});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
