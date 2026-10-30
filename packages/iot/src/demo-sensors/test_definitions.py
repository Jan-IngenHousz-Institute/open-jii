"""Run the demo macro bodies without a deployed Lambda or third-party packages."""

import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent
WRAPPER = ROOT.parents[3] / "apps/macro-sandbox/lib/wrappers/wrapper.py"
FAMILIES = ("multispeq", "ambit", "minipar")
IDENTITIES = {f"simulated:{family}" for family in FAMILIES}


def check_recording(value, key=""):
    if isinstance(value, dict):
        for child_key, child in value.items():
            check_recording(child, child_key)
    elif isinstance(value, list):
        for child in value:
            check_recording(child, key)
    else:
        if re.search(
            r"latitude|longitude|gps|user[_-]?id|person[_-]?id|serial|address",
            key,
            re.I,
        ):
            assert value in (None, ""), f"Identifying field: {key}"
        if key in ("device_id", "sensor_id"):
            assert value in IDENTITIES, f"Unreserved identity: {value}"
        if isinstance(value, str):
            assert not re.search(r"(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}", value, re.I), value
            assert not re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", value, re.I), value
            assert not re.search(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value, re.I), value


class DemoDefinitionsTest(unittest.TestCase):
    def test_each_macro_returns_expected_finite_outputs(self):
        for family in FAMILIES:
            with self.subTest(family=family):
                folder = ROOT / family
                recording = json.loads((folder / "recording.placeholder.json").read_text())
                manifest = json.loads((folder / "manifest.json").read_text())
                protocol = json.loads((folder / "protocol.json").read_text())
                self.assertIsInstance(protocol, list)
                self.assertTrue(protocol)
                self.assertEqual(manifest["family"], family)
                self.assertTrue(manifest["placeholder"])
                self.assertEqual(recording["device_id"], f"simulated:{family}")
                self.assertEqual(recording["device_firmware"], manifest["firmwareVersion"])
                self.assertEqual(recording["sample"][0]["protocol_id"], manifest["protocolVersion"])
                with tempfile.TemporaryDirectory() as temporary:
                    input_path = Path(temporary) / "input.json"
                    input_path.write_text(
                        json.dumps(
                            [
                                {
                                    "id": family,
                                    "data": recording["sample"][0],
                                    "context": {},
                                }
                            ]
                        )
                    )
                    process = subprocess.run(
                        [
                            sys.executable,
                            str(WRAPPER),
                            str(folder / "macro.py"),
                            str(input_path),
                        ],
                        check=True,
                        capture_output=True,
                        text=True,
                        timeout=10,
                        env={
                            **os.environ,
                            "PYTHONPATH": str(WRAPPER.parent.parent / "helpers"),
                        },
                    )
                response = json.loads(process.stdout)
                self.assertEqual(response["status"], "success", response)
                self.assertEqual(len(response["results"]), 1)
                result = response["results"][0]
                self.assertEqual(result["id"], family)
                self.assertTrue(result["success"], result)
                output = result["output"]
                self.assertEqual(output, manifest["expectedOutput"])
                self.assertTrue(all(math.isfinite(value) for value in output.values()))
                json.dumps(output, allow_nan=False)

    def test_every_recording_is_scrubbed(self):
        recordings = list(ROOT.glob("*/recording*.json"))
        self.assertEqual(len(recordings), len(FAMILIES))
        for path in recordings:
            with self.subTest(path=path):
                check_recording(json.loads(path.read_text()))

    def test_scrubber_rejects_identifying_data(self):
        for value in (
            {"device_id": "12345678"},
            {"device_address": "12:34:56:78:9A:BC"},
            {"latitude": 52.0},
            {"GPS": [4.0, 52.0]},
            {"contact": "person@example.com"},
            {"nested": [{"value": "12345678-1234-1234-1234-123456789abc"}]},
        ):
            with self.subTest(value=value), self.assertRaises(AssertionError):
                check_recording(value)


if __name__ == "__main__":
    unittest.main()
