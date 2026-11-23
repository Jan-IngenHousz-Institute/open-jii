import { registerAs } from "@nestjs/config";

export default registerAs("cors", () => ({
  enabled: process.env.CORS_ENABLED !== "false",
  options: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
      : ["http://localhost:3000"],
    credentials: true,
    exposedHeaders: ["Content-Disposition", "X-Data-Source"],
    // Lets the browser skip the preflight on repeat writes to the same URL, such as autosave.
    // Two hours is Chrome's ceiling.
    maxAge: 7200,
  },
}));
