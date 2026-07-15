"""
Multi-device workbook e2e: connect 4 mock MultispeQs, run a protocol cell,
verify per-device results (device 3 fails its first round), rerun to green.

Requires the local stack (see README.md) and `?mockDevices=1` support
(non-production builds). Screenshots -> /tmp/e2e-multi-device.
"""

from __future__ import annotations

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


def create_workbook(page, protocol_id: str, protocol_name: str) -> str:
    """Create a workbook with one protocol cell via the API, using the session cookies."""
    body = {
        "name": "[E2E] Multi-device",
        "cells": [
            {
                "id": str(uuid.uuid4()),
                "type": "protocol",
                "isCollapsed": False,
                "payload": {"protocolId": protocol_id, "version": 1, "name": protocol_name},
            }
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


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    protocol_id, protocol_name = seed_protocol()
    print(f"Seed protocol: {protocol_name} ({protocol_id})")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 1000})
        page = context.new_page()
        console_errors: list[str] = []
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )

        print("Logging in...")
        login(page)

        workbook_id = create_workbook(page, protocol_id, protocol_name)
        print(f"Workbook created: {workbook_id}")

        page.goto(f"{BASE_URL}/{LOCALE}/platform/workbooks/{workbook_id}?mockDevices=1")
        page.wait_for_load_state("networkidle")
        dismiss_cookie_banner(page)
        page.screenshot(path=f"{OUT}/01-workbook.png", full_page=True)

        print("Connecting 4 mock devices...")
        connect_mock_devices(page, DEVICE_COUNT)
        page.screenshot(path=f"{OUT}/02-devices-connected.png", full_page=True)

        check("status shows 4 devices", page.get_by_text("4 devices").is_visible())
        chips = page.get_by_test_id("device-chip")
        check("4 device chips", chips.count() == DEVICE_COUNT, f"got {chips.count()}")

        print("Round 1: run the protocol cell (mock device 3 fails once)...")
        run_button = page.get_by_role("button", name=re.compile(r"^Run (?!all)")).first
        run_button.click()
        results = page.get_by_test_id("device-result")
        expect(results).to_have_count(DEVICE_COUNT, timeout=30_000)
        page.screenshot(path=f"{OUT}/03-round1-partial.png", full_page=True)

        ok = page.locator('[data-testid="device-result"][data-status="ok"]')
        failed = page.locator('[data-testid="device-result"][data-status="error"]')
        check("round 1: 3 devices ok", ok.count() == 3, f"got {ok.count()}")
        check("round 1: 1 device failed", failed.count() == 1, f"got {failed.count()}")
        check(
            "round 1: failing device is Mock MultispeQ 3",
            failed.first.inner_text().find("Mock MultispeQ 3") != -1,
        )
        check(
            "round 1: failure message shown",
            page.get_by_text("Mock device failure (simulated)").first.is_visible(),
        )

        print("Round 2: rerun; the flaky device succeeds...")
        run_button.click()
        expect(page.locator('[data-testid="device-result"][data-status="ok"]')).to_have_count(
            DEVICE_COUNT, timeout=30_000
        )
        page.screenshot(path=f"{OUT}/04-round2-all-ok.png", full_page=True)
        check(
            "round 2: all 4 devices ok",
            page.locator('[data-testid="device-result"][data-status="ok"]').count()
            == DEVICE_COUNT,
        )

        # Every device's payload is visible with its own device_id.
        for i in range(1, DEVICE_COUNT + 1):
            check(
                f"device {i} block present",
                page.get_by_text(f"Mock MultispeQ {i}").first.is_visible(),
            )

        print("Disconnect one device via its chip...")
        page.get_by_role("button", name="Disconnect Mock MultispeQ 4").click()
        expect(page.get_by_text("3 devices")).to_be_visible(timeout=5_000)
        check("chip disconnect drops to 3 devices", page.get_by_text("3 devices").is_visible())
        page.screenshot(path=f"{OUT}/05-after-disconnect.png", full_page=True)

        hard_errors = [
            e
            for e in console_errors
            if "Databricks" not in e and "404" not in e and "500" not in e and "401" not in e
        ]
        check("no unexpected console errors", len(hard_errors) == 0, "; ".join(hard_errors[:3]))

        browser.close()

    print(f"\nScreenshots in {OUT}")
    if failures:
        print(f"FAILED: {len(failures)} check(s): {failures}")
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
