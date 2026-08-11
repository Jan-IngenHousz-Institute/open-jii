"""Guardrails for the smoke test's disposable schema.

The smoke task is the only thing in this repo that issues ``DROP SCHEMA ...
CASCADE``, and it runs with a principal that can create and drop schemas in the
whole catalog. So the name it drops is not a parameter: it is generated here
behind a hard-coded prefix, validated, and validated again immediately before the
drop. There is no input -- widget, environment variable, or otherwise -- that can
steer that statement at a schema holding real data.
"""

from __future__ import annotations

import re
import uuid

# Hard-coded and deliberately unlike any schema that holds data. Every generated
# scratch schema starts with this, and nothing without it may be dropped.
SCRATCH_SCHEMA_PREFIX = "zz_v3_smoke_"

# Schemas the pipeline, the backend, and Unity Catalog itself own. None of them
# can match the prefix above; listing them makes the intent explicit and gives
# the test suite something concrete to assert against.
PROTECTED_SCHEMAS = frozenset(
    {
        "centrum",
        "default",
        "information_schema",
        "data-legacy",
        "hive_metastore",
        "samples",
        "system",
    }
)

# Unquoted UC identifier, lowercase: no dots, no quotes, no whitespace, no
# semicolons, nothing that could close an identifier and start a statement.
_SCRATCH_SCHEMA = re.compile(rf"\A{SCRATCH_SCHEMA_PREFIX}[a-z0-9]{{8,32}}\Z")
_TOKEN = re.compile(r"[^a-z0-9]")


def new_scratch_schema(run_token: str | None = None) -> str:
    """Return a fresh run-owned scratch schema name.

    ``run_token`` is only a readability aid (a job run id, say); it is sanitized
    and truncated, and randomness is always appended so two concurrent runs never
    share a schema. The result is validated before it is returned, so a caller
    cannot obtain a name that :func:`assert_disposable` would later reject.
    """
    token = _TOKEN.sub("", (run_token or "").lower())[:12]
    name = f"{SCRATCH_SCHEMA_PREFIX}{token}{uuid.uuid4().hex}"[:40]
    return assert_disposable(name)


def assert_disposable(schema: str) -> str:
    """Return ``schema`` if it is a generated scratch schema, else raise.

    Called immediately before both CREATE and DROP. Raising here is the whole
    point: a name that fails this check must abort the run rather than degrade to
    some default, because the only default that could be reached by accident is a
    schema someone's data lives in.
    """
    if not isinstance(schema, str) or not _SCRATCH_SCHEMA.match(schema):
        raise ValueError(
            f"Refusing to create or drop {schema!r}: the smoke test only touches "
            f"schemas it generated, named {SCRATCH_SCHEMA_PREFIX}<token>."
        )
    if schema in PROTECTED_SCHEMAS:  # unreachable via the prefix; belt and braces
        raise ValueError(f"Refusing to create or drop the protected schema {schema!r}")
    return schema


def assert_catalog(catalog: str) -> str:
    """Return ``catalog`` if it is a plain unquoted identifier, else raise."""
    if not isinstance(catalog, str) or not re.fullmatch(r"[A-Za-z0-9_]{1,64}", catalog):
        raise ValueError(f"Refusing to build DDL with the catalog name {catalog!r}")
    return catalog
