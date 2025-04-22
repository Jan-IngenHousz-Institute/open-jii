import { initContract } from "@ts-rest/core";

import { experimentContract } from "./experiment.contract";

const c = initContract();

export const contract = c.router({
  ...experimentContract,
});
