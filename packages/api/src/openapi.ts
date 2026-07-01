import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import fs from "fs";
import path from "path";

import { orpcContract } from "./orpc-contract";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

async function generate() {
  const openApiDocument = await generator.generate(orpcContract, {
    info: {
      title: "openJII API",
      version: "1.0.0",
      description: "REST API documentation for the openJII platform",
    },
    servers: [
      {
        url: "http://localhost:3020",
        description: "Local development",
      },
    ],
  });

  const outputDir = path.resolve(__dirname, "../dist");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "openapi.json");
  fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2));

  console.log(`OpenAPI document generated at ${outputPath}`);
}

void generate();
