import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import fs from "fs";
import path from "path";

import { contract } from "./contract";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

async function generate() {
  const openApiDocument = await generator.generate(contract, {
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

  // oRPC represents nested query objects as deepObject parameters, while the
  // HTTP adapter accepts the indexed bracket form used by the clients. Keep
  // that wire format explicit in the published document for generated clients.
  const experimentList = openApiDocument.paths?.["/api/v1/experiments"] as
    | { get?: { parameters?: Record<string, unknown>[] } }
    | undefined;
  const sortParameter = experimentList?.get?.parameters?.find(
    (parameter) => parameter.name === "sort",
  );
  if (sortParameter) {
    sortParameter.description =
      "Up to two ordered sort criteria. Encode as sort[0][field]=name&sort[0][direction]=asc (and sort[1] for a secondary criterion).";
    sortParameter.example =
      "sort[0][field]=updated&sort[0][direction]=desc&sort[1][field]=owner&sort[1][direction]=asc";
  }

  const outputDir = path.resolve(__dirname, "../dist");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "openapi.json");
  fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2));

  console.log(`OpenAPI document generated at ${outputPath}`);
}

void generate();
