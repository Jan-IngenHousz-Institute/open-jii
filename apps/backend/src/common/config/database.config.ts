import { registerAs } from "@nestjs/config";

export default registerAs("@repo/database", () => ({
  url: process.env.DATABASE_URL,
}));
