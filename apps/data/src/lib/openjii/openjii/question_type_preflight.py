"""Offline history classification. Input files must be exported through an authorized read.

Run with ``python -m openjii.question_type_preflight rows.json versions.json``.
This reports evidence and activation candidates. It never connects to a datastore or writes a ledger.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from collections import Counter

_NUMBER = re.compile(
    r"^[\x09-\x0D ]*[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?[\x09-\x0D ]*$", re.ASCII
)
_KINDS = {"number", "yes_no", "open_ended", "multi_choice", "text", "single_choice"}


def question_key(label: str) -> str:
    if not label:
        return "question_empty"
    key = re.sub(r"_+", "_", re.sub(r"[^a-z0-9_]", "_", label.lower())).strip("_")
    return f"question_{key}" if not key or key[0].isdigit() else key


def classify_history(rows: list[dict], versions: list[dict]) -> dict:
    by_version: dict[str, list[dict]] = {}
    for version in versions:
        by_version.setdefault(version["id"], []).append(version)
    columns: dict[tuple[str, str], Counter] = {}
    for row in rows:
        entries = [q for q in row.get("questions") or [] if q is not None]
        keys = Counter(question_key(q.get("question_label") or "") for q in entries)
        for q in entries:
            key = question_key(q.get("question_label") or "")
            counts = columns.setdefault((row["experiment_id"], key), Counter())
            counts["answers"] += 1
            candidates = by_version.get(row.get("workbook_version_id"), [])
            matching = [
                cell
                for version in candidates
                for cell in version.get("cells", [])
                if cell.get("type") == "question"
                and cell.get("name") == q.get("question_label")
                and cell.get("question", {}).get("text") == q.get("question_text")
            ]
            if not row.get("workbook_version_id") or not candidates or not matching:
                counts["no_version"] += 1
            snapshot_kind = (
                matching[0]["question"].get("kind") if len(candidates) == 1 and len(matching) == 1 else None
            )
            wire_kind = q.get("question_kind")
            kind = wire_kind or snapshot_kind
            ambiguous = keys[key] > 1 or len(candidates) > 1 or len(matching) > 1
            contradictory = (
                wire_kind and snapshot_kind and (wire_kind == "number") != (snapshot_kind == "number")
            )
            if ambiguous or contradictory:
                counts["conflicts"] += 1
                counts["unknown"] += 1
            elif kind not in _KINDS:
                counts["unknown"] += 1
            else:
                counts["number" if kind == "number" else "text"] += 1
                if not wire_kind:
                    counts["recovered_from_version"] += 1
            answer = q.get("question_answer")
            if answer is None or not str(answer).strip():
                counts["blank"] += 1
            elif kind == "number" and (
                not _NUMBER.fullmatch(str(answer)) or not math.isfinite(float(answer))
            ):
                counts["invalid_number"] += 1
    output = []
    for (experiment, key), counts in sorted(columns.items()):
        eligible = (
            counts["number"] == counts["answers"]
            and not counts["invalid_number"]
            and not counts["no_version"]
        )
        output.append(
            {
                "experiment_id": experiment,
                "key": key,
                **dict(sorted(counts.items())),
                "eligible_numeric": eligible,
            }
        )
    proof = hashlib.sha256(
        json.dumps({"rows": rows, "versions": versions}, sort_keys=True).encode()
    ).hexdigest()
    return {"input_sha256": proof, "rows": len(rows), "columns": output}


if __name__ == "__main__":
    with open(sys.argv[1]) as source, open(sys.argv[2]) as snapshots:
        print(json.dumps(classify_history(json.load(source), json.load(snapshots)), indent=2, sort_keys=True))
