"""Check the format toggle inside the protocol *editor*, where it rewrites the doc.

The viewer is read-only; the editor path reformats live CodeMirror text and feeds
it back through validation and autosave. This asserts the reformat is lossless
(the parsed protocol is byte-identical in the DB afterwards).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

from helpers import BASE_URL, LOCALE, PG_CONTAINER, PG_DB, PG_USER, login

OUT = os.environ.get("E2E_OUT", "/tmp/e2e-json-layout")


def psql(sql: str) -> str:
    return subprocess.check_output(
        ["podman", "exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-tAc", sql],
        text=True,
    ).strip()


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    pid = sys.argv[1] if len(sys.argv) > 1 else psql(
        "SELECT id FROM protocols ORDER BY length(code::text) DESC LIMIT 1;"
    )
    before = json.loads(psql(f"SELECT code::text FROM protocols WHERE id = '{pid}';"))
    print(f"protocol: {pid}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1100})
        login(page)
        page.goto(f"{BASE_URL}/{LOCALE}/platform/protocols/{pid}")
        page.wait_for_load_state("networkidle")

        # Click the viewer to drop into the editor.
        page.locator('[data-testid="json-viewer-wrapper"]').first.click()
        page.wait_for_timeout(1200)

        toggles = page.locator('[data-testid="json-format-toggle"]')
        toggles.first.wait_for(timeout=10_000)
        toggle = toggles.first
        print(f"editor toggle enabled: {toggle.is_enabled()}")

        page.screenshot(path=f"{OUT}/04-editor-compact.png")
        toggle.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/05-editor-expanded.png")

        # Type invalid JSON and confirm the toggle disables itself.
        editor = page.locator(".cm-content").first
        editor.click()
        page.keyboard.press("Control+Home")
        page.keyboard.type("~~")
        page.wait_for_timeout(1200)
        disabled_on_invalid = not toggle.is_enabled()
        print(f"toggle disabled while JSON is invalid: {disabled_on_invalid}")
        page.screenshot(path=f"{OUT}/06-editor-invalid.png")

        # Undo the damage and settle.
        page.keyboard.press("Control+Z")
        page.wait_for_timeout(2500)
        browser.close()

    after = json.loads(psql(f"SELECT code::text FROM protocols WHERE id = '{pid}';"))
    lossless = before == after
    print(f"protocol data unchanged after reformat: {lossless}")

    ok = disabled_on_invalid and lossless
    print(f"\n{'PASS' if ok else 'FAIL'}   screenshots in {OUT}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
