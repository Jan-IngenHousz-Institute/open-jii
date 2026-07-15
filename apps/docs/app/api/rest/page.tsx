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
      <section className="border-fd-border bg-fd-card mb-8 rounded-lg border p-6">
        <h1 id="authenticate-with-an-api-key" className="text-2xl font-semibold">
          Authenticate with an API key
        </h1>
        <p className="text-fd-muted-foreground mt-3">
          Endpoints that require a signed-in user also accept a personal API key. Create one under
          <strong className="text-fd-foreground"> Account → API keys</strong>, then send it in the
          <code className="text-fd-foreground mx-1">x-api-key</code> header. The key is shown only
          once when it is created.
        </p>
        <pre className="bg-fd-secondary mt-4 overflow-x-auto rounded-md p-4 text-sm">
          <code>{'curl -H "x-api-key: jii_..." https://<backend-host>/api/v1/experiments'}</code>
        </pre>
        <ul className="text-fd-muted-foreground mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>Keys act as the user who created them and have that user&apos;s permissions.</li>
          <li>Missing or revoked keys return 401; malformed keys return 403.</li>
          <li>Each key is rate limited to 100 requests per minute by default.</li>
          <li>Keys may expire and can be revoked immediately from the API keys tab.</li>
          <li>Keys are stored hashed; treat them like passwords and rotate leaked keys.</li>
        </ul>
      </section>
      <OpenAPIPage payload={{ bundled }} operations={operations} showTitle showDescription />
    </div>
  );
}
