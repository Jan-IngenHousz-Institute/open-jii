import { setupServer } from "msw/node";

import { handlers } from "./handlers";
import { createMount } from "./mount";

const _server = setupServer(...handlers);

export const server = Object.assign(_server, {
  mount: createMount(_server),
});
