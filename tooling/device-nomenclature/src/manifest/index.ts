import { aggregateManifest } from "./aggregate.js";
import { apiRules } from "./shards/api.js";
import { backendRules } from "./shards/backend.js";
import { databaseRules } from "./shards/database.js";
import { docsRules } from "./shards/docs.js";
import { iotRules } from "./shards/iot.js";
import { mobileRules } from "./shards/mobile.js";
import { otherAppRules } from "./shards/other-app.js";
import { toolingRules } from "./shards/tooling.js";
import { webRules } from "./shards/web.js";

export const manifest = aggregateManifest({
  api: apiRules,
  backend: backendRules,
  database: databaseRules,
  docs: docsRules,
  iot: iotRules,
  mobile: mobileRules,
  otherApp: otherAppRules,
  tooling: toolingRules,
  web: webRules,
});
