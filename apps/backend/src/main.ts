import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });

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
    });
  }

  await app.listen(process.env.PORT ?? 3020);
}

void bootstrap();
