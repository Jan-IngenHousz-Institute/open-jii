import json

import pytest

from skill_library import (MAX_CATALOG_BYTES, MAX_PACKAGE_BYTES, MAX_RESOURCE_BYTES,
                           SkillLibraryError, load_skill_library)


def package(root, content="Packaged instructions", reference="Reference text"):
    folder = root / "example"
    folder.mkdir(exist_ok=True)
    (folder / "SKILL.md").write_text(content)
    (folder / "reference.md").write_text(reference)
    manifest = {"version": 1, "skills": [{"id": "example", "description": "Use for example research",
        "resources": {"SKILL.md": "example/SKILL.md", "reference.md": "example/reference.md"}}]}
    (root / "runtime-catalog.json").write_text(json.dumps(manifest))
    return manifest


def test_empty_library_does_not_enable_candidate_skills(tmp_path):
    (tmp_path / "catalog.json").write_text('{"skills": ["candidate"]}')
    library = load_skill_library(tmp_path)
    assert library.catalog == []
    assert library.hash == load_skill_library(tmp_path).hash
    with pytest.raises(SkillLibraryError):
        library.read({"skillId": "candidate", "resource": "SKILL.md"})


def test_content_snapshot_hash_and_provenance(tmp_path):
    package(tmp_path, "Read 葉")
    library = load_skill_library(tmp_path)
    value = library.read({"skillId": "example", "resource": "SKILL.md"})
    assert value["content"] == "Read 葉"
    assert value["bytes"] == len("Read 葉".encode())
    assert value["libraryHash"] == library.hash
    assert len(value["sha256"]) == 64
    (tmp_path / "example/SKILL.md").write_text("Changed")
    assert library.read({"skillId": "example", "resource": "SKILL.md"}) == value
    assert load_skill_library(tmp_path).hash != library.hash


@pytest.mark.parametrize("arguments", [
    {"skillId": "../secret", "resource": "SKILL.md"},
    {"skillId": "example", "resource": "../secret"},
    {"skillId": "example", "resource": "/etc/passwd"},
    {"skillId": "example", "resource": "https://example.com"},
    {"skillId": "example", "resource": "reference.md", "path": "/etc/passwd"},
    {"skillId": "example", "resource": []},
])
def test_model_can_only_select_exact_allowlisted_keys(tmp_path, arguments):
    package(tmp_path)
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path).read(arguments)


@pytest.mark.parametrize("path", ["../secret.md", "/tmp/secret.md", "example/../secret.md",
                                  "example\\secret.md", "https://example.com/a.md"])
def test_manifest_cannot_escape_package(tmp_path, path):
    manifest = package(tmp_path)
    manifest["skills"][0]["resources"]["SKILL.md"] = path
    (tmp_path / "runtime-catalog.json").write_text(json.dumps(manifest))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)


@pytest.mark.parametrize("target", ["runtime-catalog.json", "example/SKILL.md", "example"])
def test_rejects_file_directory_and_manifest_symlinks(tmp_path, target):
    package(tmp_path)
    original = tmp_path / target
    moved = original.with_name(original.name + "-real")
    original.rename(moved)
    original.symlink_to(moved)
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)


def test_file_and_package_and_catalog_limits(tmp_path):
    package(tmp_path, "x" * (MAX_RESOURCE_BYTES + 1))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)
    manifest = package(tmp_path, "x" * MAX_RESOURCE_BYTES)
    for index in range(MAX_PACKAGE_BYTES // MAX_RESOURCE_BYTES):
        manifest["skills"][0]["resources"][f"extra-{index}.md"] = "example/SKILL.md"
    (tmp_path / "runtime-catalog.json").write_text(json.dumps(manifest))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)
    (tmp_path / "runtime-catalog.json").write_text(" " * (MAX_CATALOG_BYTES + 1))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)


@pytest.mark.parametrize("change", ["duplicate", "missing-entrypoint", "missing-file", "non-utf8"])
def test_invalid_packages_fail_closed(tmp_path, change):
    manifest = package(tmp_path)
    if change == "duplicate":
        manifest["skills"] *= 2
    elif change == "missing-entrypoint":
        del manifest["skills"][0]["resources"]["SKILL.md"]
    elif change == "missing-file":
        (tmp_path / "example/reference.md").unlink()
    else:
        (tmp_path / "example/reference.md").write_bytes(b"\xff")
    (tmp_path / "runtime-catalog.json").write_text(json.dumps(manifest))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)


def test_default_package_is_independent_of_working_directory(tmp_path, monkeypatch):
    expected = load_skill_library().hash
    monkeypatch.chdir(tmp_path)
    assert load_skill_library().hash == expected


@pytest.mark.parametrize("overflow", ["skills", "resources"])
def test_catalog_entry_count_bounds(tmp_path, overflow):
    manifest = package(tmp_path)
    if overflow == "skills":
        manifest["skills"] = [{**manifest["skills"][0], "id": f"skill-{n}"} for n in range(9)]
    else:
        manifest["skills"][0]["resources"].update({f"r{n}.md": "example/SKILL.md" for n in range(33)})
    (tmp_path / "runtime-catalog.json").write_text(json.dumps(manifest))
    with pytest.raises(SkillLibraryError):
        load_skill_library(tmp_path)


@pytest.mark.parametrize("change", ["tool", "runtime", "provenance", "prompt"])
def test_hash_binds_runtime_contract(tmp_path, monkeypatch, change):
    import skill_library
    package(tmp_path)
    before = load_skill_library(tmp_path).hash
    if change == "tool":
        monkeypatch.setitem(skill_library.READ_SKILL_TOOL["function"], "description", "Changed tool guidance")
    elif change == "runtime":
        monkeypatch.setattr(skill_library, "SKILL_RUNTIME_PROTOCOL_VERSION", 999)
    elif change == "provenance":
        monkeypatch.setattr(skill_library, "PROVENANCE_PROTOCOL_VERSION", 999)
    else:
        monkeypatch.setattr(skill_library.SkillLibrary, "prompt", lambda self: "Changed catalog guidance")
    assert load_skill_library(tmp_path).hash != before


def provenance(library, count=1, resource="SKILL.md"):
    read = library.read({"skillId": "example", "resource": resource})
    return {"hash": library.hash, "reads": [
        {"callId": f"read-{index}", **{key: read[key] for key in ("skillId", "resource", "sha256", "bytes")}}
        for index in range(count)
    ]}


def test_validate_provenance_returns_independent_validated_metadata(tmp_path):
    package(tmp_path, "葉")
    library = load_skill_library(tmp_path)
    value = provenance(library, 32)
    value["reads"][0]["callId"] = "x" * 200
    validated = library.validate_provenance(value)
    assert validated == value
    assert validated is not value and validated["reads"] is not value["reads"]
    value["reads"][0]["bytes"] = 0
    assert validated["reads"][0]["bytes"] == 3
    assert library.validate_provenance({"hash": library.hash, "reads": []})["reads"] == []


@pytest.mark.parametrize("change", ["hash", "top-extra", "reads-type", "count", "duplicate",
    "record-type", "missing", "extra", "empty-id", "blank-id", "long-id", "id-type", "skill", "resource",
    "digest", "digest-type", "bytes", "bool-bytes", "float-bytes", "resource-type"])
def test_validate_provenance_rejects_invalid_records(tmp_path, change):
    package(tmp_path)
    library = load_skill_library(tmp_path)
    value = provenance(library)
    record = value["reads"][0]
    if change == "hash": value["hash"] = "stale"
    elif change == "top-extra": value["extra"] = 1
    elif change == "reads-type": value["reads"] = {}
    elif change == "count": value = provenance(library, 33)
    elif change == "duplicate": value["reads"].append(dict(record))
    elif change == "record-type": value["reads"] = [None]
    elif change == "missing": del record["bytes"]
    elif change == "extra": record["content"] = "not metadata"
    elif change == "empty-id": record["callId"] = ""
    elif change == "blank-id": record["callId"] = " "
    elif change == "long-id": record["callId"] = "x" * 201
    elif change == "id-type": record["callId"] = []
    elif change == "skill": record["skillId"] = "unknown"
    elif change == "resource": record["resource"] = "../secret"
    elif change == "digest": record["sha256"] = "0" * 64
    elif change == "digest-type": record["sha256"] = []
    elif change == "bytes": record["bytes"] += 1
    elif change == "bool-bytes": record["bytes"] = True
    elif change == "float-bytes": record["bytes"] = float(record["bytes"])
    elif change == "resource-type": record["resource"] = []
    with pytest.raises(SkillLibraryError):
        library.validate_provenance(value)


def test_validate_provenance_cumulative_byte_boundary(tmp_path):
    package(tmp_path, "x" * MAX_RESOURCE_BYTES)
    library = load_skill_library(tmp_path)
    assert len(library.validate_provenance(provenance(library, 2))["reads"]) == 2
    with pytest.raises(SkillLibraryError):
        library.validate_provenance(provenance(library, 3))
