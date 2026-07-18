"""Tests for openjii.compression."""

from __future__ import annotations

import base64
import gzip
import json

import pytest
from openjii.compression import decompress_sample_value


@pytest.fixture
def sample_payload() -> str:
    return json.dumps([{"label": "PAM", "data_raw": [1.0, 2.0, 3.0]}])


def _gzip_b64(payload: str) -> str:
    return base64.b64encode(gzip.compress(payload.encode("utf-8"))).decode("ascii")


class TestDecompressSampleValue:
    def test_passthrough_when_encoding_is_none(self, sample_payload: str) -> None:
        assert decompress_sample_value(sample_payload, None) == sample_payload

    def test_passthrough_when_value_is_none(self) -> None:
        assert decompress_sample_value(None, "gzip+base64") is None
        assert decompress_sample_value(None, None) is None

    def test_decompresses_gzip_base64(self, sample_payload: str) -> None:
        encoded = _gzip_b64(sample_payload)
        assert decompress_sample_value(encoded, "gzip+base64") == sample_payload

    def test_unicode_round_trip(self) -> None:
        payload = json.dumps({"emoji": "🌱", "umlaut": "öß"}, ensure_ascii=False)
        encoded = _gzip_b64(payload)
        assert decompress_sample_value(encoded, "gzip+base64") == payload

    def test_unknown_encoding_passes_through_unchanged(self) -> None:
        # Forward-compat: future encodings shouldn't crash silver.
        assert decompress_sample_value("opaque", "zstd+base64") == "opaque"

    def test_invalid_base64_raises(self) -> None:
        # Garbage in -> exception out (binascii.Error or gzip.BadGzipFile),
        # not silent truncation.
        import binascii

        with pytest.raises((binascii.Error, OSError, ValueError)):
            decompress_sample_value("not-base64-!@#$", "gzip+base64")
