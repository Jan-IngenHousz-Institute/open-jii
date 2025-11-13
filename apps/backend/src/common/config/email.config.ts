import { registerAs } from "@nestjs/config";

export default registerAs("email", () => ({
  baseUrl: process.env.EMAIL_BASE_URL,
  server: process.env.EMAIL_SERVER,
  from: process.env.EMAIL_FROM,
}));
