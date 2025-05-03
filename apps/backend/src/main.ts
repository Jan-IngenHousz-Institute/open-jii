import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";

import { AppModule } from "./app.module";

// Load environment variables from .env file
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3020);
}

bootstrap();
