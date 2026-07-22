import { load } from "js-yaml";
import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AsyncApiDocsApiHeader,
  AsyncApiDocsServers,
  AsyncApiDocsSecurity,
  AsyncApiDocsOperations,
  AsyncApiDocsMessages,
  AsyncApiDocsContactLicense,
} from "./asyncapi-docs-ui";
import type { AsyncApiSpec } from "./asyncapi-docs-ui";

export const metadata: Metadata = {
  title: "MQTT API Reference",
  description: "openJII MQTT (AsyncAPI) reference for AWS IoT Core topics and messages.",
};

// asyncapi.yaml is synced from the canonical root spec during the docs build
// (see scripts/sync-specs.mjs), so topics are baked into the static export.
function loadSpec(): AsyncApiSpec {
  const raw = readFileSync(resolve(process.cwd(), "public/asyncapi.yaml"), "utf8");
  return load(raw) as AsyncApiSpec;
}

export default function MqttApiPage() {
  const { info, servers, channels, components } = loadSpec();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <AsyncApiDocsApiHeader info={info} servers={servers} />
      <AsyncApiDocsServers servers={servers} />
      <AsyncApiDocsSecurity securitySchemes={components?.securitySchemes} />
      <AsyncApiDocsOperations channels={channels} />
      <AsyncApiDocsMessages messages={components?.messages} />
      <AsyncApiDocsContactLicense info={info} />
    </div>
  );
}
