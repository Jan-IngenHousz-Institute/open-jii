import { registerAs } from "@nestjs/config";

import { env } from "@repo/env";

export default registerAs("@repo/database", () => ({
  url: env.DATABASE_URL,
}));
