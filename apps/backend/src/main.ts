import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import corsConfig from "./common/config/cors.config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Required for Better Auth
  });

  app.useBodyParser("json", { limit: "10mb" });

  // Use nestjs-pino logger
  app.useLogger(app.get(Logger));

  const cors = app.get<ConfigType<typeof corsConfig>>(corsConfig.KEY);
  if (cors.enabled) {
    app.enableCors(cors.options);
  }

  // Only the running service: the signal listeners these register would accumulate
  // across spec files, and the harness closes its application itself.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3020);
}

void bootstrap();
