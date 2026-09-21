"""Validate synthetic evaluation calls against exported production tool schemas.

This checks JSON shape, not database permissions or backend domain refinements.
"""

from typing import Any

from jsonschema import FormatChecker
from jsonschema.validators import validator_for

from evaluation.contract import TOOLS

_VALIDATORS = {}
for tool in TOOLS:
    function = tool["function"]
    schema = function["parameters"]
    validator = validator_for(schema)
    validator.check_schema(schema)
    _VALIDATORS[function["name"]] = validator(schema, format_checker=FormatChecker())


def tool_arguments_are_valid(name: str, arguments: Any) -> bool:
    validator = _VALIDATORS.get(name)
    return validator is not None and isinstance(arguments, dict) and validator.is_valid(arguments)
