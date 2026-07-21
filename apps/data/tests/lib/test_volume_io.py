"""Tests for ambyte.volume_io (filesystem discovery + filename parsing)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from ambyte.volume_io import (
    discover_and_validate_upload_directories,
    find_upload_directories,
    parse_upload_time,
)


class TestParseUploadTime:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("upload_20250901_01", datetime(2025, 9, 1)),
            ("upload_20240229_07", datetime(2024, 2, 29)),  # 2024 is a leap year
            ("upload_19991231_42", datetime(1999, 12, 31)),
        ],
    )
    def test_valid_names_parse_to_midnight_utc(self, name: str, expected: datetime) -> None:
        assert parse_upload_time(name) == expected

    def test_strict_date_rejects_invalid_calendar(self) -> None:
        # 2025 is not a leap year -> Feb 29 returns None.
        assert parse_upload_time("upload_20250229_01") is None

    def test_returns_none_for_malformed_names(self) -> None:
        assert parse_upload_time("not_an_upload") is None
        assert parse_upload_time("upload_2025-09-01_01") is None
        assert parse_upload_time("upload_20250901") is None


class TestFindUploadDirectories:
    def test_returns_only_upload_prefixed_subdirs(self, tmp_path: Path) -> None:
        (tmp_path / "upload_20250901_01").mkdir()
        (tmp_path / "upload_20250902_02").mkdir()
        (tmp_path / "other_dir").mkdir()
        (tmp_path / "upload_not_a_dir.txt").write_text("ignored")

        result = find_upload_directories(str(tmp_path))
        names = sorted(Path(p).name for p in result)
        assert names == ["upload_20250901_01", "upload_20250902_02"]

    def test_missing_base_path_returns_empty(self, tmp_path: Path) -> None:
        # No exception, just an empty list.
        assert find_upload_directories(str(tmp_path / "does_not_exist")) == []


class TestDiscoverAndValidate:
    def test_success_flag_when_directories_present(self, tmp_path: Path) -> None:
        (tmp_path / "upload_20250901_01").mkdir()
        dirs, ok = discover_and_validate_upload_directories(str(tmp_path))
        assert ok is True
        assert len(dirs) == 1

    def test_failure_flag_when_no_directories(self, tmp_path: Path) -> None:
        dirs, ok = discover_and_validate_upload_directories(str(tmp_path))
        assert ok is False
        assert dirs == []
