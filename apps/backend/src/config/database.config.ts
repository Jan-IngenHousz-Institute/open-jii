import { registerAs } from "@nestjs/config";

import { env } from "src/env";

export default registerAs("@repo/database", () => ({
  url: env.server.DATABASE_URL,
}));
