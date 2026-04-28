import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Required for Better Auth
  });

  app.useBodyParser("json", { limit: "10mb" });

  // Use nestjs-pino logger
  app.useLogger(app.get(Logger));

  const corsEnabled = process.env.CORS_ENABLED !== "false";
  if (corsEnabled) {
    const corsOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
      : ["http://localhost:3000"]; // Default origin

    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    });
  }

  await app.listen(process.env.PORT ?? 3020);
}

void bootstrap();
