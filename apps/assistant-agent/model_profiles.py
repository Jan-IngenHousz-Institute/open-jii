"""Endpoint compatibility settings; the environment allowlist still grants access."""

import hashlib
import json
from pathlib import Path
from typing import Any


def load_profiles() -> dict[str, dict[str, Any]]:
    profiles = json.loads(Path(__file__).with_name("model_profiles.json").read_text())
    if not isinstance(profiles, dict):
        raise ValueError("Model profiles must be an object")
    for name, profile in profiles.items():
        if not name or not isinstance(profile, dict):
            raise ValueError("Invalid model profile")
        if set(profile) - {"toolReasoningEffort", "maxOutputTokens"}:
            raise ValueError(f"Unknown compatibility setting for {name}")
        limit = profile.get("maxOutputTokens", 8192)
        if type(limit) is not int or not 1 <= limit <= 8192:
            raise ValueError(f"Invalid output limit for {name}")
        if "toolReasoningEffort" in profile and profile["toolReasoningEffort"] not in {
            "none", "minimal", "low", "medium", "high",
        }:
            raise ValueError(f"Invalid reasoning effort for {name}")
    return profiles


PROFILES = load_profiles()


def apply_profile(model: str, payload: dict[str, Any]) -> dict[str, Any]:
    profile = PROFILES.get(model, {})
    result = dict(payload)
    cap = profile.get("maxOutputTokens", 8192)
    for key in ("max_tokens", "max_completion_tokens"):
        if key in result:
            result[key] = min(result[key], cap)
    if result.get("tools") and "toolReasoningEffort" in profile:
        result["reasoning_effort"] = profile["toolReasoningEffort"]
    return result


def profile_metadata(model: str) -> dict[str, Any]:
    profile = {"maxOutputTokens": 8192, **PROFILES.get(model, {})}
    encoded = json.dumps(profile, sort_keys=True, separators=(",", ":")).encode()
    return {"settings": profile, "sha256": hashlib.sha256(encoded).hexdigest()}
