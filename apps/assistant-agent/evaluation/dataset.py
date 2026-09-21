"""Load and validate the curated assistant evaluation dataset."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

DATASET_PATH = Path(__file__).with_name("dataset.jsonl")
FIXTURE_KIND = "synthetic_scoped_tool_results"
TOOL_NAMES = {
    "search_entities",
    "get_entity",
    "search_knowledge",
    "query_experiment_data",
    "draft_entity",
}
REQUIRED_SCENARIOS = {
    "knowledge_citation",
    "refused_access",
    "draft_only_write",
    "unsupported_question",
    "malicious_source_instruction",
}
SECRET_PATTERNS = (
    re.compile(r"(?i)bearer\s+[a-z0-9._~-]{12,}"),
    re.compile(r"(?i)(api[_-]?key|gateway[_-]?token|password)\s*[:=]\s*[^\s\"']+"),
    re.compile(r"\bdapi[a-f0-9]{20,}\b", re.IGNORECASE),
)


class DatasetValidationError(ValueError):
    """Raised when an evaluation row violates the local dataset contract."""


def load_dataset(path: Path = DATASET_PATH) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise DatasetValidationError(
                    f"{path}:{line_number}: invalid JSON: {error.msg}"
                ) from error
            if not isinstance(row, dict):
                raise DatasetValidationError(f"{path}:{line_number}: row must be an object")
            rows.append(row)
    validate_dataset(rows)
    return rows


def validate_dataset(rows: list[dict[str, Any]]) -> None:
    if not rows:
        raise DatasetValidationError("dataset must contain at least one row")

    ids: set[str] = set()
    scenarios: set[str] = set()
    for index, row in enumerate(rows, start=1):
        context = f"row {index}"
        allowed_keys = {"id", "inputs", "expectations", "fixture"}
        if set(row) != allowed_keys:
            raise DatasetValidationError(
                f"{context}: fields must be exactly {sorted(allowed_keys)}"
            )

        case_id = row.get("id")
        if not isinstance(case_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,79}", case_id):
            raise DatasetValidationError(f"{context}: id must be a stable lowercase slug")
        if case_id in ids:
            raise DatasetValidationError(f"{context}: duplicate id {case_id!r}")
        ids.add(case_id)

        _validate_inputs(row.get("inputs"), context)
        expectations = _expect_dict(row.get("expectations"), f"{context}.expectations")
        scenario = expectations.get("scenario")
        if not isinstance(scenario, str) or not scenario:
            raise DatasetValidationError(f"{context}: expectations.scenario is required")
        scenarios.add(scenario)
        _validate_expectations(expectations, context)
        _validate_fixture(row.get("fixture"), context)

        serialized = json.dumps(row, sort_keys=True)
        if any(pattern.search(serialized) for pattern in SECRET_PATTERNS):
            raise DatasetValidationError(f"{context}: possible credential material is forbidden")

    missing = REQUIRED_SCENARIOS - scenarios
    if missing:
        raise DatasetValidationError(f"dataset is missing required scenarios: {sorted(missing)}")


def _validate_inputs(value: Any, context: str) -> None:
    inputs = _expect_dict(value, f"{context}.inputs")
    if set(inputs) != {"messages"}:
        raise DatasetValidationError(
            f"{context}: inputs may contain only messages; fixtures and expectations stay out of model input"
        )
    messages = inputs.get("messages")
    if not isinstance(messages, list) or not messages:
        raise DatasetValidationError(f"{context}: inputs.messages must be a non-empty list")
    for message in messages:
        if (
            not isinstance(message, dict)
            or set(message) != {"role", "content"}
            or message.get("role") not in {"user", "assistant"}
            or not isinstance(message.get("content"), str)
            or not message["content"].strip()
        ):
            raise DatasetValidationError(
                f"{context}: messages require only a user/assistant role and non-empty content"
            )


def _validate_expectations(expectations: dict[str, Any], context: str) -> None:
    list_fields = {
        "requiredToolNames",
        "forbiddenToolNames",
        "forbiddenAnswerTerms",
    }
    bool_fields = {
        "mustRefuse",
        "mustBeDraftOnly",
        "unsupported",
        "resistsSourceInstructions",
    }
    required_fields = {"scenario", "requiredCitations", *list_fields, *bool_fields}
    if set(expectations) != required_fields:
        raise DatasetValidationError(
            f"{context}: expectation fields must be exactly {sorted(required_fields)}"
        )
    for field in list_fields:
        value = expectations[field]
        if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
            raise DatasetValidationError(f"{context}: {field} must be a list of strings")
    for field in bool_fields:
        if not isinstance(expectations[field], bool):
            raise DatasetValidationError(f"{context}: {field} must be boolean")
    required = set(expectations["requiredToolNames"])
    forbidden = set(expectations["forbiddenToolNames"])
    if not required <= TOOL_NAMES or not forbidden <= TOOL_NAMES:
        raise DatasetValidationError(f"{context}: expectation refers to an unknown tool")
    if required & forbidden:
        raise DatasetValidationError(f"{context}: a tool cannot be both required and forbidden")

    citations = expectations["requiredCitations"]
    if not isinstance(citations, list):
        raise DatasetValidationError(f"{context}: requiredCitations must be a list")
    for citation in citations:
        if not isinstance(citation, dict) or set(citation) != {"sourceId", "title", "page"}:
            raise DatasetValidationError(
                f"{context}: each citation requires sourceId, title, and page"
            )
        if not isinstance(citation["sourceId"], str) or not citation["sourceId"]:
            raise DatasetValidationError(f"{context}: citation sourceId is required")
        if not isinstance(citation["title"], str) or not citation["title"]:
            raise DatasetValidationError(f"{context}: citation title is required")
        if citation["page"] is not None and (
            not isinstance(citation["page"], int) or isinstance(citation["page"], bool) or citation["page"] < 1
        ):
            raise DatasetValidationError(f"{context}: citation page must be null or a positive integer")


def _validate_fixture(value: Any, context: str) -> None:
    fixture = _expect_dict(value, f"{context}.fixture")
    if set(fixture) != {"kind", "tools"} or fixture.get("kind") != FIXTURE_KIND:
        raise DatasetValidationError(
            f"{context}: fixture must be explicitly labelled {FIXTURE_KIND!r}"
        )
    tools = _expect_dict(fixture.get("tools"), f"{context}.fixture.tools")
    if not set(tools) <= TOOL_NAMES:
        raise DatasetValidationError(f"{context}: fixture contains an unknown tool")
    for name, definition in tools.items():
        item = _expect_dict(definition, f"{context}.fixture.tools.{name}")
        if set(item) != {"argumentsContain", "status", "result"}:
            raise DatasetValidationError(
                f"{context}: fixture tool requires argumentsContain, status, and result"
            )
        _expect_dict(item["argumentsContain"], f"{context}.fixture.tools.{name}.argumentsContain")
        if item["status"] not in {"completed", "failed"}:
            raise DatasetValidationError(f"{context}: fixture tool status is invalid")
        if item["status"] == "completed" and item["result"] is None:
            raise DatasetValidationError(f"{context}: completed fixture tool requires a result")
        if item["status"] == "failed" and not isinstance(item["result"], str):
            raise DatasetValidationError(f"{context}: failed fixture tool requires an error string")


def _expect_dict(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise DatasetValidationError(f"{context} must be an object")
    return value
