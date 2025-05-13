import { NestFactory } from "@nestjs/core";

import { auth } from "@repo/auth/express";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // app.use("/auth/*splat", auth);

  await app.listen(process.env.PORT ?? 3020);
}

bootstrap();
