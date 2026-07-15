"""
Multi-device workbook e2e: connect 4 mock MultispeQs, run a protocol cell,
verify per-device results (device 3 fails its first round), rerun to green.

Requires the local stack (see README.md) and `?mockDevices=1` support
(non-production builds). Screenshots -> /tmp/e2e-multi-device.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import uuid

from helpers import BASE_URL, LOCALE, _psql, dismiss_cookie_banner, login
from playwright.sync_api import expect, sync_playwright

OUT = os.environ.get("E2E_OUT", "/tmp/e2e-multi-device")
API_URL = os.environ.get("E2E_API_URL", "http://localhost:3020")
DEVICE_COUNT = 4
# E2E_VIDEO=1 records the run to <OUT>/multi-device.webm (with pauses so the
# flow is watchable, not just machine-fast).
RECORD = os.environ.get("E2E_VIDEO") == "1"


def pause(page, ms: int) -> None:
    if RECORD:
        page.wait_for_timeout(ms)

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {name}" + (f": {detail}" if detail and not condition else ""))
    if not condition:
        failures.append(name)


def seed_protocol() -> tuple[str, str]:
    row = _psql("SELECT id, name FROM protocols WHERE family = 'multispeq' LIMIT 1;")
    protocol_id, name = row.split("|", 1)
    return protocol_id, name


MACRO_NAME = "[E2E] Phi2 per device"
# Sandbox contract (wrapper.py): measurement arrives as `json`, results go
# into the `output` dict. Imports are blocked; plain arithmetic only.
MACRO_CODE = """fm_prime = json['Fm_prime']
fs = json['Fs']
output['Phi2'] = round((fm_prime - fs) / fm_prime, 3)
output['device'] = json.get('device_id')
"""


def create_macro(page) -> str:
    """Create (or reuse) the e2e macro via the API, using the session cookies."""
    existing = _psql(f"SELECT id FROM macros WHERE name = '{MACRO_NAME}' LIMIT 1;")
    if existing:
        return existing
    resp = page.request.post(
        f"{API_URL}/api/v1/macros",
        data=json.dumps(
            {
                "name": MACRO_NAME,
                "description": "Per-device Phi2 for the multi-device e2e",
                "language": "python",
                "code": base64.b64encode(MACRO_CODE.encode()).decode(),
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status == 201, f"createMacro -> {resp.status}: {resp.text()}"
    return resp.json()["id"]


def create_workbook(page, protocol_id: str, protocol_name: str, macro_id: str, macro_name: str) -> str:
    """Create a protocol + macro + command workbook via the API, using the session cookies."""
    body = {
        "name": "[E2E] Multi-device",
        "cells": [
            {
                "id": str(uuid.uuid4()),
                "type": "protocol",
                "isCollapsed": False,
                "payload": {"protocolId": protocol_id, "version": 1, "name": protocol_name},
            },
            {
                "id": str(uuid.uuid4()),
                "type": "macro",
                "isCollapsed": False,
                "payload": {"macroId": macro_id, "language": "python", "name": macro_name},
            },
            {
                "id": str(uuid.uuid4()),
                "type": "command",
                "isCollapsed": False,
                "payload": {"format": "string", "content": "hello", "name": "Hello command"},
            },
        ],
    }
    resp = page.request.post(
        f"{API_URL}/api/v1/workbooks",
        data=json.dumps(body),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status == 201, f"createWorkbook -> {resp.status}: {resp.text()}"
    return resp.json()["id"]


def connect_mock_devices(page, count: int) -> None:
    # Pick the "Mock" connection type (only offered with ?mockDevices=1).
    page.locator("button", has_text="Serial").first.click()
    page.get_by_role("option", name="Mock").click()

    for i in range(1, count + 1):
        page.get_by_test_id("connect-device").click()
        # Each mock device appears in the status line or chips as it connects.
        if i == 1:
            expect(page.get_by_text("Mock MultispeQ 1")).to_be_visible(timeout=10_000)
        else:
            expect(page.get_by_text(f"{i} devices")).to_be_visible(timeout=10_000)
        pause(page, 600)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    protocol_id, protocol_name = seed_protocol()
    print(f"Seed protocol: {protocol_name} ({protocol_id})")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context_args = {"viewport": {"width": 1600, "height": 1000}}
        if RECORD:
            context_args["record_video_dir"] = OUT
            context_args["record_video_size"] = {"width": 1600, "height": 1000}
        context = browser.new_context(**context_args)
        page = context.new_page()
        console_errors: list[str] = []
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )

        print("Logging in...")
        login(page)

        macro_id = create_macro(page)
        print(f"Macro created: {macro_id}")
        workbook_id = create_workbook(page, protocol_id, protocol_name, macro_id, MACRO_NAME)
        print(f"Workbook created: {workbook_id}")

        page.goto(f"{BASE_URL}/{LOCALE}/platform/workbooks/{workbook_id}?mockDevices=1")
        page.wait_for_load_state("networkidle")
        dismiss_cookie_banner(page)
        pause(page, 1500)
        page.screenshot(path=f"{OUT}/01-workbook.png", full_page=True)

        print("Connecting 4 mock devices...")
        connect_mock_devices(page, DEVICE_COUNT)
        page.screenshot(path=f"{OUT}/02-devices-connected.png", full_page=True)

        check("status shows 4 devices", page.get_by_text("4 devices").is_visible())
        chips = page.get_by_test_id("device-chip")
        check("4 device chips", chips.count() == DEVICE_COUNT, f"got {chips.count()}")

        run_protocol = page.get_by_role("button", name=re.compile(r"^Run .*Chlorophyll")).first
        run_macro = page.get_by_role("button", name=re.compile(r"^Run .*Phi2")).first
        run_command = page.get_by_role("button", name=re.compile(r"^Run Hello command")).first

        def device_results(status: str | None = None):
            sel = '[data-testid="device-result"]'
            if status:
                sel += f'[data-status="{status}"]'
            return page.locator(sel)

        print("Round 1: run the protocol cell (mock device 3 fails once)...")
        run_protocol.click()
        expect(device_results()).to_have_count(DEVICE_COUNT, timeout=30_000)
        pause(page, 1200)
        device_results().nth(2).scroll_into_view_if_needed()
        pause(page, 2500)
        page.screenshot(path=f"{OUT}/03-round1-partial.png", full_page=True)

        check("round 1: 3 devices ok", device_results("ok").count() == 3)
        check("round 1: 1 device failed", device_results("error").count() == 1)
        check(
            "round 1: failing device is Mock MultispeQ 3",
            device_results("error").first.inner_text().find("Mock MultispeQ 3") != -1,
        )
        check(
            "round 1: failure message shown",
            page.get_by_text("Mock device failure (simulated)").first.is_visible(),
        )

        print("Round 2: rerun; the flaky device succeeds...")
        page.get_by_test_id("device-chip").first.scroll_into_view_if_needed()
        pause(page, 800)
        run_protocol.click()
        expect(device_results("ok")).to_have_count(DEVICE_COUNT, timeout=30_000)
        pause(page, 1000)
        device_results().nth(2).scroll_into_view_if_needed()
        pause(page, 2500)
        page.screenshot(path=f"{OUT}/04-round2-all-ok.png", full_page=True)
        check("round 2: all 4 devices ok", device_results("ok").count() == DEVICE_COUNT)

        # Every device's payload is visible with its own device_id.
        for i in range(1, DEVICE_COUNT + 1):
            check(
                f"device {i} block present",
                page.get_by_text(f"Mock MultispeQ {i}").first.is_visible(),
            )

        print("Macro: applies to every device's measurement individually...")
        run_macro.scroll_into_view_if_needed()
        pause(page, 800)
        run_macro.click()
        # 4 protocol blocks + 4 macro blocks once the macro round lands.
        expect(device_results("ok")).to_have_count(2 * DEVICE_COUNT, timeout=60_000)
        pause(page, 1000)
        macro_results = device_results("ok")
        macro_results.nth(2 * DEVICE_COUNT - 2).scroll_into_view_if_needed()
        pause(page, 2500)
        page.screenshot(path=f"{OUT}/05-macro-per-device.png", full_page=True)
        check("macro: 4 per-device outputs", device_results("ok").count() == 2 * DEVICE_COUNT)
        phi2_blocks = page.get_by_text("Phi2", exact=False)
        check("macro: Phi2 values rendered", phi2_blocks.count() >= DEVICE_COUNT)

        print("Command: hello fans out to every device...")
        run_command.scroll_into_view_if_needed()
        pause(page, 800)
        run_command.click()
        expect(device_results("ok")).to_have_count(3 * DEVICE_COUNT, timeout=30_000)
        pause(page, 1000)
        device_results("ok").nth(3 * DEVICE_COUNT - 2).scroll_into_view_if_needed()
        pause(page, 2500)
        page.screenshot(path=f"{OUT}/06-command-per-device.png", full_page=True)
        check("command: 4 per-device outputs", device_results("ok").count() == 3 * DEVICE_COUNT)
        check(
            "command: device reply rendered",
            page.get_by_text("MultispeQ Ready").first.is_visible(),
        )

        print("Disconnect one device via its chip...")
        page.get_by_test_id("device-chip").first.scroll_into_view_if_needed()
        pause(page, 800)
        page.get_by_role("button", name="Disconnect Mock MultispeQ 4").click()
        expect(page.get_by_text("3 devices")).to_be_visible(timeout=5_000)
        check("chip disconnect drops to 3 devices", page.get_by_text("3 devices").is_visible())
        pause(page, 1500)
        page.screenshot(path=f"{OUT}/07-after-disconnect.png", full_page=True)

        hard_errors = [
            e
            for e in console_errors
            if "Databricks" not in e and "404" not in e and "500" not in e and "401" not in e
        ]
        check("no unexpected console errors", len(hard_errors) == 0, "; ".join(hard_errors[:3]))

        video = page.video if RECORD else None
        context.close()
        video_path = video.path() if video else None
        browser.close()

    if video_path:
        final = os.path.join(OUT, "multi-device.webm")
        os.replace(video_path, final)
        print(f"Video: {final}")
    print(f"\nScreenshots in {OUT}")
    if failures:
        print(f"FAILED: {len(failures)} check(s): {failures}")
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
