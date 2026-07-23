"""Canonical-measurement contract guard (Python).

Validates the private backend-to-sandbox marker and classifies each item's data
as a postcondition check. It never re-shapes or picks a value. Modes: "shadow"
(classify+report, execution unchanged) and "enforce".
"""

import json
import sys

INPUT_CONTRACT = "canonical-measurement-v1"

GUARD_MODES = ("shadow", "enforce")

CLASSIFICATIONS = ("canonical", "empty-envelope", "non-canonical-envelope")

# Per-item error code surfaced when a classification is not canonical.
ITEM_ERROR_CODES = {
    "empty-envelope": "empty-envelope",
    "non-canonical-envelope": "non-canonical-input",
}

# Invocation-level error when the marker is missing/unsupported (enforce).
MARKER_ERROR_CODE = "unsupported-input-contract"


def classify_value(value):
    """Classify one item's data against the canonical postcondition.

    A canonical value is a direct measurement; a recognized top-level `sample`
    object/array or a top-level array is still-wrapped residue; empty recognized
    shapes ({"sample": []}, []) are the stable empty-envelope case.
    """
    if isinstance(value, list):
        return "empty-envelope" if len(value) == 0 else "non-canonical-envelope"

    if isinstance(value, dict) and "sample" in value:
        sample = value["sample"]
        if isinstance(sample, list):
            return "empty-envelope" if len(sample) == 0 else "non-canonical-envelope"
        if isinstance(sample, dict):
            return "non-canonical-envelope"
        # A scalar/None `sample` is not an envelope; the object is direct.
        return "canonical"

    return "canonical"


def error_for_classification(classification):
    return ITEM_ERROR_CODES.get(classification)


def classify_items(items):
    """Per-item decision list in request order."""
    decisions = []
    for item in items:
        data = item.get("data") if isinstance(item, dict) else None
        item_id = item.get("id") if isinstance(item, dict) else None
        classification = classify_value(data)
        decisions.append(
            {
                "id": item_id,
                "classification": classification,
                "error": error_for_classification(classification),
            }
        )
    return decisions


def build_telemetry(input_contract, marker_valid, decisions, mode):
    """Shadow-mode telemetry: counts + identifiers only, never contents/source."""
    counts = {"canonical": 0, "empty-envelope": 0, "non-canonical-envelope": 0}
    empty_envelope_ids = []
    non_canonical_ids = []
    for d in decisions:
        counts[d["classification"]] = counts.get(d["classification"], 0) + 1
        if d["classification"] == "empty-envelope":
            empty_envelope_ids.append(d["id"])
        elif d["classification"] == "non-canonical-envelope":
            non_canonical_ids.append(d["id"])
    return {
        "event": "macro-guard",
        "mode": mode,
        # Bounded facts only. Never echo the caller-supplied marker value.
        "markerPresent": isinstance(input_contract, str),
        "markerValid": marker_valid,
        "itemCount": len(decisions),
        "counts": counts,
        "emptyEnvelopeIds": empty_envelope_ids,
        "nonCanonicalIds": non_canonical_ids,
    }


def guard_batch(event, mode="shadow"):
    """Guard a whole batch. `mode` defaults to shadow."""
    guard_mode = mode if mode in GUARD_MODES else "shadow"
    input_contract = event.get("input_contract") if isinstance(event, dict) else None
    marker_valid = input_contract == INPUT_CONTRACT
    items = event.get("items") if isinstance(event, dict) else None
    if not isinstance(items, list):
        items = []
    decisions = classify_items(items)
    return {
        "mode": guard_mode,
        "markerValid": marker_valid,
        "markerError": MARKER_ERROR_CODE if (not marker_valid and guard_mode == "enforce") else None,
        "decisions": decisions,
        "telemetry": build_telemetry(input_contract, marker_valid, decisions, guard_mode),
    }


def partition_items(items, decisions):
    """Split into executable (canonical) and pre-failed subsets, keeping order."""
    valid_items = []
    invalid_results = []
    for item, decision in zip(items, decisions):
        if decision["classification"] == "canonical":
            valid_items.append(item)
        else:
            invalid_results.append(
                {"id": decision["id"], "success": False, "error": decision["error"]}
            )
    return valid_items, invalid_results


def merge_results(decisions, executed_results, invalid_results):
    """Reassemble strictly by original position, never by id, so duplicate and
    empty item IDs round-trip losslessly."""
    merged = []
    vi = 0
    ii = 0
    for d in decisions:
        if d["classification"] == "canonical":
            merged.append(executed_results[vi])
            vi += 1
        else:
            merged.append(invalid_results[ii])
            ii += 1
    return merged


def _run_enforce(marker, lines):
    """stdin '<id>\\t<dataJson>' lines -> positional enforce merge, mirroring guard.js."""
    items = []
    for line in lines:
        id_part, tab, data_json = line.partition("\t")
        items.append({"id": id_part, "data": json.loads(data_json if tab else "")})
    guard = guard_batch({"input_contract": marker, "items": items}, "enforce")
    if not guard["markerValid"]:
        return "MARKER_INVALID\t" + str(guard["markerError"]) + "\n"
    valid_items, invalid_results = partition_items(items, guard["decisions"])
    executed = [{"id": it["id"], "success": True} for it in valid_items]
    merged = merge_results(guard["decisions"], executed, invalid_results)
    out = [str(r["id"]) + "\t" + str(r["success"]).lower() + "\t" + (r.get("error") or "-") for r in merged]
    return "\n".join(out) + ("\n" if out else "")


def _main(argv):
    """CLI conformance runner mirroring guard.js."""
    if "--marker" in argv:
        idx = argv.index("--marker")
        value = argv[idx + 1] if idx + 1 < len(argv) else None
        sys.stdout.write(str(value == INPUT_CONTRACT).lower() + "\n")
        return

    lines = [line.rstrip("\n") for line in sys.stdin if line.strip() != ""]

    if "--enforce" in argv:
        idx = argv.index("--enforce")
        marker = argv[idx + 1] if idx + 1 < len(argv) else None
        sys.stdout.write(_run_enforce(marker, lines))
        return

    out = []
    for line in lines:
        classification = classify_value(json.loads(line))
        out.append(classification + "\t" + (error_for_classification(classification) or "-"))
    sys.stdout.write("\n".join(out) + ("\n" if out else ""))


if __name__ == "__main__":
    _main(sys.argv[1:])
