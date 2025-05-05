import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

config();
// Also load default env values from database package
config({ path: resolve(__dirname, '../../packages/database/.env.default') });

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3020);
}

bootstrap();
