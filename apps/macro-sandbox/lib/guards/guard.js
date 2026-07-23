// Canonical-measurement contract guard (JavaScript).
// Validates the private backend-to-sandbox marker and classifies each item's
// data as a postcondition check. It never re-shapes or picks a value.
// Modes: "shadow" (classify+report, execution unchanged) and "enforce".

const INPUT_CONTRACT = "canonical-measurement-v1";

const GUARD_MODES = ["shadow", "enforce"];

const CLASSIFICATIONS = ["canonical", "empty-envelope", "non-canonical-envelope"];

// Per-item error code surfaced when a classification is not canonical.
const ITEM_ERROR_CODES = {
  "empty-envelope": "empty-envelope",
  "non-canonical-envelope": "non-canonical-input",
};

// Invocation-level error when the marker is missing/unsupported (enforce).
const MARKER_ERROR_CODE = "unsupported-input-contract";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Classify one item's `data` against the canonical postcondition. A canonical
// value is a direct measurement; a recognized top-level `sample` object/array or
// a top-level array is still-wrapped residue; empty recognized shapes
// ({sample:[]}, []) are the stable empty-envelope case.
function classifyValue(value) {
  if (Array.isArray(value)) {
    return value.length === 0 ? "empty-envelope" : "non-canonical-envelope";
  }

  if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "sample")) {
    const sample = value.sample;
    if (Array.isArray(sample)) {
      return sample.length === 0 ? "empty-envelope" : "non-canonical-envelope";
    }
    if (isPlainObject(sample)) {
      return "non-canonical-envelope";
    }
    // A scalar/null `sample` is not an envelope; the object is direct.
    return "canonical";
  }

  return "canonical";
}

function errorForClassification(classification) {
  return ITEM_ERROR_CODES[classification] ?? null;
}

// Per-item decision list in request order.
function classifyItems(items) {
  return items.map((item) => {
    const classification = classifyValue(item ? item.data : undefined);
    return {
      id: item ? item.id : undefined,
      classification,
      error: errorForClassification(classification),
    };
  });
}

// Shadow-mode telemetry: counts + identifiers only, never measurement contents
// or macro source.
function buildTelemetry(inputContract, markerValid, decisions, mode) {
  const counts = { canonical: 0, "empty-envelope": 0, "non-canonical-envelope": 0 };
  const emptyEnvelopeIds = [];
  const nonCanonicalIds = [];
  for (const d of decisions) {
    counts[d.classification] = (counts[d.classification] ?? 0) + 1;
    if (d.classification === "empty-envelope") emptyEnvelopeIds.push(d.id);
    else if (d.classification === "non-canonical-envelope") nonCanonicalIds.push(d.id);
  }
  return {
    event: "macro-guard",
    mode,
    // Bounded facts only. Never echo the caller-supplied marker value, which an
    // untrusted caller could stuff with measurement or source text.
    markerPresent: typeof inputContract === "string",
    markerValid,
    itemCount: decisions.length,
    counts,
    emptyEnvelopeIds,
    nonCanonicalIds,
  };
}

// Guard a whole batch. `mode` defaults to shadow.
function guardBatch(event, mode) {
  const guardMode = GUARD_MODES.includes(mode) ? mode : "shadow";
  const inputContract = event ? event.input_contract : undefined;
  const markerValid = inputContract === INPUT_CONTRACT;
  const items = Array.isArray(event && event.items) ? event.items : [];
  const decisions = classifyItems(items);
  return {
    mode: guardMode,
    markerValid,
    markerError: !markerValid && guardMode === "enforce" ? MARKER_ERROR_CODE : null,
    decisions,
    telemetry: buildTelemetry(inputContract, markerValid, decisions, guardMode),
  };
}

// Split items into the executable (canonical) subset and pre-failed subset,
// preserving request order. Enforce only; shadow runs every item unchanged.
function partitionItems(items, decisions) {
  const validItems = [];
  const invalidResults = [];
  for (let i = 0; i < items.length; i++) {
    const decision = decisions[i];
    if (decision.classification === "canonical") {
      validItems.push(items[i]);
    } else {
      invalidResults.push({ id: decision.id, success: false, error: decision.error });
    }
  }
  return { validItems, invalidResults };
}

// Reassemble executed + pre-failed results strictly by original position, never
// by id. Duplicate and empty item IDs round-trip losslessly. executedResults are
// in the order of the canonical items; invalidResults in the order of the rest.
function mergeResults(decisions, executedResults, invalidResults) {
  let vi = 0;
  let ii = 0;
  return decisions.map((d) =>
    d.classification === "canonical" ? executedResults[vi++] : invalidResults[ii++],
  );
}

module.exports = {
  INPUT_CONTRACT,
  GUARD_MODES,
  CLASSIFICATIONS,
  ITEM_ERROR_CODES,
  MARKER_ERROR_CODE,
  classifyValue,
  errorForClassification,
  classifyItems,
  guardBatch,
  partitionItems,
  mergeResults,
  buildTelemetry,
};

// CLI conformance runner. Modes:
//   default            one compact JSON value per stdin line -> "<class>\t<err|->"
//   --marker <value>   prints markerValid for that contract string
//   --enforce <marker> stdin "<id>\t<dataJson>" lines -> positional enforce merge
function runEnforce(marker, lines) {
  const items = lines.map((line) => {
    const tab = line.indexOf("\t");
    const id = tab === -1 ? line : line.slice(0, tab);
    const dataJson = tab === -1 ? "" : line.slice(tab + 1);
    return { id, data: JSON.parse(dataJson) };
  });
  const guard = guardBatch({ input_contract: marker, items }, "enforce");
  if (!guard.markerValid) {
    return "MARKER_INVALID\t" + guard.markerError + "\n";
  }
  const { validItems, invalidResults } = partitionItems(items, guard.decisions);
  const executed = validItems.map((it) => ({ id: it.id, success: true }));
  const merged = mergeResults(guard.decisions, executed, invalidResults);
  return (
    merged.map((r) => r.id + "\t" + String(r.success) + "\t" + (r.error ?? "-")).join("\n") +
    (merged.length ? "\n" : "")
  );
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const markerFlag = argv.indexOf("--marker");
  if (markerFlag !== -1) {
    process.stdout.write(String(argv[markerFlag + 1] === INPUT_CONTRACT) + "\n");
    process.exit(0);
  }

  const enforceFlag = argv.indexOf("--enforce");
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
  });
  process.stdin.on("end", () => {
    const lines = buffer.split("\n").filter((l) => l.trim() !== "");
    if (enforceFlag !== -1) {
      process.stdout.write(runEnforce(argv[enforceFlag + 1], lines));
      return;
    }
    const out = lines.map((line) => {
      const classification = classifyValue(JSON.parse(line));
      return classification + "\t" + (errorForClassification(classification) ?? "-");
    });
    process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
  });
}
