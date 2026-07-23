import { openapi } from "@/lib/openapi";
import type { OperationItem } from "fumadocs-openapi/ui";
import type { Metadata } from "next";

import { OpenAPIPage } from "./openapi-page";

export const metadata: Metadata = {
  title: "REST API Reference",
  description: "openJII REST API reference, generated from the platform contract.",
};

const METHODS: OperationItem["method"][] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

export default async function RestApiPage() {
  const schemas = await openapi.getSchemas();
  const { bundled } = Object.values(schemas)[0];

  if (!bundled.paths) {
    return <p className="p-8">No REST operations found in the OpenAPI document.</p>;
  }

  const operations: OperationItem[] = [];
  for (const [path, item] of Object.entries(bundled.paths)) {
    if (!item) continue;
    for (const method of METHODS) {
      if (item[method]) operations.push({ path, method });
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <OpenAPIPage payload={{ bundled }} operations={operations} showTitle showDescription />
    </div>
  );
}
