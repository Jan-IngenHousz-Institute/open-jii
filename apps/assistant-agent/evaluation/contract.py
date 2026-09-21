"""Production prompt and JSON tool schemas exported after the backend build."""

import json
from pathlib import Path

CONTRACT = json.loads(Path(__file__).with_name("contract.json").read_text(encoding="utf-8"))
SYSTEM_PROMPT = CONTRACT["systemPrompt"]
TOOLS = CONTRACT["tools"]
CONTRACT_SHA256 = CONTRACT["sha256"]
