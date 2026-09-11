import { load } from "js-yaml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// asyncapi.yaml is the published contract for the MQTT ingest payload, but the
// pipeline is what actually consumes it. Nothing regenerates one from the
// other, so this check fails the PR when a field is added to (or dropped from)
// the pipeline without the same move in the spec.

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const specPath = path.join(repoRoot, "asyncapi.yaml");
const schemasPath = path.join(repoRoot, "apps/data/src/lib/openjii/openjii/centrum/schemas.py");
const bronzePath = path.join(repoRoot, "apps/data/src/pipelines/centrum/bronze/raw_data.py");

// Present in the pipeline but never published by a device, so they have no
// place in a spec that describes what publishers send.
const BROKER_INJECTED = {
  // "SELECT topic() as topic, clientid() as client_id, *" in the IoT topic rule.
  topic: "stamped by the AWS IoT topic rule",
  client_id: "stamped by the AWS IoT topic rule",
  // The large-IoT path reads this from the S3 object key, not the payload.
  experiment_id: "extracted from the S3 object key",
};

// Documented but not read by the pipeline: a publisher-side field that must
// still appear in the contract.
const PUBLISHER_ONLY = {
  workbook_id: "mobile-local macro replay aid; the pipeline keys on workbook_version_id",
};

function structFieldNames(schemaBlock) {
  const fieldCalls = [...schemaBlock.matchAll(/\bStructField\s*\(/g)].length;
  const names = [...schemaBlock.matchAll(/\bStructField\s*\(\s*(["'])([^"']+)\1/g)].map(
    (match) => match[2],
  );
  assert.equal(
    names.length,
    fieldCalls,
    `parsed ${names.length} of ${fieldCalls} StructField declarations; field names must be string literals`,
  );
  return names;
}

function structFields(source, schemaName) {
  const start = source.indexOf(`${schemaName} = StructType(`);
  assert.notEqual(start, -1, `${schemaName} not found in ${path.basename(schemasPath)}`);
  const end = source.indexOf("\n)\n", start);
  assert.notEqual(end, -1, `${schemaName} block is not terminated`);
  const names = structFieldNames(source.slice(start, end));
  // A silently-empty match set would make every assertion below pass vacuously.
  assert.ok(names.length >= 15, `${schemaName} parsed as only ${names.length} fields`);
  return names;
}

assert.deepEqual(
  structFieldNames(`StructField(
    'line_wrapped', StringType(), True
  )\nStructField("same_line", StringType(), True)`),
  ["line_wrapped", "same_line"],
  "StructField parsing must accept line breaks and either Python quote style",
);

function jsonPathExtractions(source) {
  const names = [...source.matchAll(/"\$\.([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
  assert.ok(names.includes("client_id"), "bronze get_json_object extractions parsed as empty");
  return names;
}

const [specSource, schemasSource, bronzeSource] = await Promise.all([
  readFile(specPath, "utf8"),
  readFile(schemasPath, "utf8"),
  readFile(bronzePath, "utf8"),
]);

const spec = load(specSource);
const documented = spec?.components?.messages?.ExperimentDataMessage?.payload?.properties;
assert.ok(documented, "asyncapi.yaml has no ExperimentDataMessage payload properties");
const documentedNames = new Set(Object.keys(documented));
assert.ok(documentedNames.has("timestamp"), "ExperimentDataMessage payload parsed as empty");

// Every publisher-sent field the pipeline consumes, from all three ingest
// surfaces: the Kinesis/MQTT parse schema, the large-payload S3 parse schema,
// and the fields bronze pulls off the raw JSON with get_json_object.
const consumed = new Map();
const record = (name, origin) => {
  if (!(name in BROKER_INJECTED)) consumed.set(name, consumed.get(name) ?? origin);
};
for (const name of structFields(schemasSource, "sensor_schema")) record(name, "sensor_schema");
for (const name of structFields(schemasSource, "large_iot_schema"))
  record(name, "large_iot_schema");
for (const name of jsonPathExtractions(bronzeSource)) record(name, "bronze raw_data extraction");

const undocumented = [...consumed].filter(([name]) => !documentedNames.has(name));
assert.equal(
  undocumented.length,
  0,
  `asyncapi.yaml does not document ${undocumented.length} field(s) the centrum pipeline reads:\n` +
    undocumented.map(([name, origin]) => `  - ${name} (${origin})`).join("\n") +
    "\nAdd them under components.messages.ExperimentDataMessage.payload.properties, " +
    "then run 'pnpm --filter docs sync-specs'.",
);

const stale = [...documentedNames].filter(
  (name) => !consumed.has(name) && !(name in PUBLISHER_ONLY),
);
assert.equal(
  stale.length,
  0,
  `asyncapi.yaml documents ${stale.length} field(s) no centrum pipeline schema reads: ${stale.join(", ")}.\n` +
    "Remove them, or record the exemption in PUBLISHER_ONLY in this script with the reason.",
);

console.log(
  `MQTT ingest contract check passed: asyncapi.yaml documents all ${consumed.size} pipeline-consumed payload fields.`,
);
