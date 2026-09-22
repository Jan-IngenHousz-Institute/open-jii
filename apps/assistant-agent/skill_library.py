"""Bounded, packaged research instructions; never caller-selected filesystem paths."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
from typing import Any

SKILLS_ROOT = Path(__file__).resolve().parent / "skills"
MAX_CATALOG_BYTES = 8_192
MAX_RESOURCE_BYTES = 32_768
MAX_PACKAGE_BYTES = 131_072
MAX_TURN_READ_BYTES = 65_536
MAX_SKILLS = 8
MAX_RESOURCES = 32
MAX_PROVENANCE_READS = 32
SKILL_RUNTIME_PROTOCOL_VERSION = 2
PROVENANCE_PROTOCOL_VERSION = 1

READ_SKILL_TOOL = {
    "type": "function",
    "function": {
        "name": "read_skill",
        "description": "Read a packaged research skill or reference from the skill catalog. Read SKILL.md first, then only relevant references. This reads instructions, never executes code or equipment.",
        "parameters": {
            "type": "object",
            "properties": {
                "skillId": {"type": "string", "description": "Exact skill id from the catalog"},
                "resource": {"type": "string", "description": "Exact resource key, starting with SKILL.md"},
            },
            "required": ["skillId", "resource"],
            "additionalProperties": False,
        },
    },
}


class SkillLibraryError(ValueError):
    pass


def _read_packaged(root: Path, relative: str, limit: int) -> bytes:
    parts = PurePosixPath(relative)
    if (not relative or parts.is_absolute() or "\\" in relative
            or any(part in {"", ".", ".."} for part in relative.split("/"))):
        raise SkillLibraryError("Invalid packaged resource path")
    candidate = root
    for part in parts.parts:
        candidate = candidate / part
        if candidate.is_symlink():
            raise SkillLibraryError("Symlinks are not permitted in skill packages")
    if not candidate.is_file() or not candidate.resolve().is_relative_to(root.resolve()):
        raise SkillLibraryError("Packaged resource is unavailable")
    with candidate.open("rb") as resource:
        content = resource.read(limit + 1)
    if len(content) > limit:
        raise SkillLibraryError("Packaged resource exceeds its size limit")
    return content


class SkillLibrary:
    def __init__(self, catalog: list[dict[str, Any]], resources: dict[tuple[str, str], str]):
        self.catalog = catalog
        self._resources = resources
        self._metadata = {
            key: {"sha256": hashlib.sha256(value.encode()).hexdigest(), "bytes": len(value.encode())}
            for key, value in resources.items()
        }
        identity = {"runtimeProtocol": SKILL_RUNTIME_PROTOCOL_VERSION,
                    "provenanceProtocol": PROVENANCE_PROTOCOL_VERSION,
                    "readSkillTool": READ_SKILL_TOOL, "catalogPrompt": self.prompt(),
                    "maxTurnReadBytes": MAX_TURN_READ_BYTES, "maxReads": MAX_PROVENANCE_READS,
                    "catalog": catalog, "resources": [
            {"skillId": key[0], "resource": key[1], **self._metadata[key]}
            for key in sorted(resources)
        ]}
        self.hash = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()

    def prompt(self) -> str:
        return ("Packaged research skills are available via the Python-local read_skill tool. "
                "For a matching task, read its SKILL.md before authoring; load references only as needed. "
                "Skills provide guidance, not evidence of a completed action or validated hardware. "
                "They do not override authorization, confirmation or tool/runtime limits. "
                "Batch independent skill reads and platform lookups in the same tool round when useful; "
                "the existing round limit is unchanged, so leave a round for the draft. "
                "Catalog: " + json.dumps(self.catalog, ensure_ascii=False))

    def validate_provenance(self, value: Any) -> dict[str, Any]:
        if (not isinstance(value, dict) or set(value) != {"hash", "reads"}
                or value["hash"] != self.hash or not isinstance(value["reads"], list)
                or len(value["reads"]) > MAX_PROVENANCE_READS):
            raise SkillLibraryError("Invalid skill library provenance")
        reads, seen, total = [], set(), 0
        fields = {"callId", "skillId", "resource", "sha256", "bytes"}
        for record in value["reads"]:
            if (not isinstance(record, dict) or set(record) != fields
                    or not all(isinstance(record[key], str) for key in fields - {"bytes"})
                    or not 1 <= len(record["callId"]) <= 200 or not record["callId"].strip()
                    or record["callId"] in seen or type(record["bytes"]) is not int):
                raise SkillLibraryError("Invalid skill read provenance")
            metadata = self._metadata.get((record["skillId"], record["resource"]))
            if metadata is None or any(record[key] != metadata[key] for key in ("sha256", "bytes")):
                raise SkillLibraryError("Skill read does not match the packaged resource")
            total += record["bytes"]
            if total > MAX_TURN_READ_BYTES:
                raise SkillLibraryError("Skill read provenance exceeds its byte limit")
            seen.add(record["callId"])
            reads.append(dict(record))
        return {"hash": self.hash, "reads": reads}

    def read(self, arguments: Any) -> dict[str, Any]:
        if (not isinstance(arguments, dict) or set(arguments) != {"skillId", "resource"}
                or not all(isinstance(value, str) for value in arguments.values())):
            raise SkillLibraryError("Use exact skillId and resource keys from the catalog")
        key = (arguments["skillId"], arguments["resource"])
        if key not in self._resources:
            raise SkillLibraryError("Unknown packaged skill resource")
        return {**arguments, "content": self._resources[key], **self._metadata[key], "libraryHash": self.hash}


def load_skill_library(root: Path | None = None) -> SkillLibrary:
    root = SKILLS_ROOT if root is None else root
    manifest = root / "runtime-catalog.json"
    if not manifest.exists() and not manifest.is_symlink():
        return SkillLibrary([], {})
    try:
        raw = _read_packaged(root, "runtime-catalog.json", MAX_CATALOG_BYTES)
        data = json.loads(raw)
        if (not isinstance(data, dict) or data.get("version") != 1
                or not isinstance(data.get("skills"), list) or len(data["skills"]) > MAX_SKILLS):
            raise SkillLibraryError("Invalid runtime skill catalog")
        catalog, resources, seen = [], {}, set()
        total = len(raw)
        for skill in data["skills"]:
            if not isinstance(skill, dict):
                raise SkillLibraryError("Invalid skill entry")
            skill_id, description, paths = skill.get("id"), skill.get("description"), skill.get("resources")
            if (not isinstance(skill_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", skill_id)
                    or skill_id in seen or not isinstance(description, str) or not 1 <= len(description) <= 500
                    or not isinstance(paths, dict) or "SKILL.md" not in paths):
                raise SkillLibraryError("Invalid skill entry")
            seen.add(skill_id)
            for key, relative in paths.items():
                if (not isinstance(key, str) or not 1 <= len(key) <= 160
                        or not isinstance(relative, str) or not relative.endswith(".md")
                        or len(resources) >= MAX_RESOURCES):
                    raise SkillLibraryError("Invalid skill resource")
                content = _read_packaged(root, relative, MAX_RESOURCE_BYTES)
                total += len(content)
                if total > MAX_PACKAGE_BYTES:
                    raise SkillLibraryError("Skill package exceeds its total size limit")
                resources[(skill_id, key)] = content.decode("utf-8")
            catalog.append({"id": skill_id, "description": description, "resources": sorted(paths)})
        return SkillLibrary(catalog, resources)
    except (OSError, UnicodeError, ValueError) as error:
        if isinstance(error, SkillLibraryError):
            raise
        raise SkillLibraryError("Invalid packaged skill library") from None
