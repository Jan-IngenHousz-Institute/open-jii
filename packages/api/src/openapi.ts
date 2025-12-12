import { generateOpenApi } from "@ts-rest/open-api";
import fs from "fs";
import path from "path";

import { contract } from "./contract";

// Generate the OpenAPI document
const openApiDocument = generateOpenApi(
  contract,
  {
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
  },
  {
    setOperationId: "concatenated-path",
    jsonQuery: true,
  },
);

// Directory for storing the OpenAPI document
const outputDir = path.resolve(__dirname, "../dist");

// Ensure the directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the OpenAPI document to a file
fs.writeFileSync(path.join(outputDir, "openapi.json"), JSON.stringify(openApiDocument, null, 2));

console.log(`OpenAPI document generated at ${path.join(outputDir, "openapi.json")}`);
