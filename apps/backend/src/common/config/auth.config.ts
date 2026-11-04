import { registerAs } from "@nestjs/config";

// The same fallback packages/auth gives Better Auth, so the backend's own URL agrees with it locally.
export default registerAs("auth", () => ({
  secret: process.env.AUTH_SECRET,
  url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020",
}));
