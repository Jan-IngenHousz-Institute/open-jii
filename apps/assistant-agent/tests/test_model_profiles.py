from model_profiles import apply_profile, PROFILES
from app import validate_payload
from fastapi import HTTPException
import pytest


def test_compatibility_profile_does_not_enable_endpoint(monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "different-endpoint")
    with pytest.raises(HTTPException) as error:
        validate_payload({"model": "databricks-gpt-5-6-luna",
                          "messages": [{"role": "user", "content": "hello"}]})
    assert error.value.status_code == 422


def test_profile_never_increases_reserved_output_or_mutates_input(monkeypatch):
    monkeypatch.setitem(PROFILES, "candidate", {"maxOutputTokens": 512,
                                               "toolReasoningEffort": "none"})
    payload = {"max_tokens": 200, "tools": [{"type": "function"}]}
    result = apply_profile("candidate", payload)
    assert result["max_tokens"] == 200
    assert result["reasoning_effort"] == "none"
    assert "reasoning_effort" not in payload
    assert apply_profile("candidate", {"max_tokens": 2000})["max_tokens"] == 512


def test_unknown_enabled_endpoint_keeps_standard_parameters():
    payload = {"max_tokens": 100, "reasoning_effort": "low"}
    assert apply_profile("candidate-without-overrides", payload) == payload


def test_profile_metadata_identifies_effective_compatibility_settings(monkeypatch):
    from model_profiles import PROFILES, profile_metadata

    before = profile_metadata("databricks-gpt-5-6-luna")
    assert before["settings"]["toolReasoningEffort"] == "none"
    monkeypatch.setitem(PROFILES, "databricks-gpt-5-6-luna", {"maxOutputTokens": 1024})
    after = profile_metadata("databricks-gpt-5-6-luna")
    assert before["sha256"] != after["sha256"]
    assert after["settings"]["maxOutputTokens"] == 1024
