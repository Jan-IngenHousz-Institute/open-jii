"""Run a calibration script locally, exactly as the sandbox Lambda will.

Usage: uv run python devshim.py my_script.py payload.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "functions" / "python"))

from handler import handler  # noqa: E402


def main():
    if len(sys.argv) != 3:
        print(__doc__.strip())
        return 2

    script = Path(sys.argv[1]).read_text()
    payload = json.loads(Path(sys.argv[2]).read_text())
    result = handler({**payload, "script": script}, None)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") == "computed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
