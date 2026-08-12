"""Toggling the JSON layout in a workbook protocol cell must not write to the server.

Autosave there keys off the raw editor text, so a reflow used to look like an
edit and persist. Watches the network for PUTs and the row's updated_at.

Usage: python3 check_workbook_reflow_no_save.py <workbook-id> <protocol-id>
"""

from __future__ import annotations

import subprocess
import sys

from playwright.sync_api import sync_playwright

from helpers import BASE_URL, LOCALE, PG_CONTAINER, PG_DB, PG_USER, login

WORKBOOK_ID = sys.argv[1] if len(sys.argv) > 1 else "07176b91-5f23-4e4b-af17-fb93f513ee70"
PROTOCOL_ID = sys.argv[2] if len(sys.argv) > 2 else "7140e9ab-67e5-4c00-a1f0-3a35c224e22e"
OUT = "/tmp/e2e-json-layout"


def psql(sql: str) -> str:
    return subprocess.check_output(
        ["podman", "exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-tAc", sql],
        text=True,
    ).strip()


def row() -> str:
    return psql(
        f"SELECT updated_at::text || ' ' || jsonb_typeof(code) || ' ' || length(code::text) "
        f"FROM protocols WHERE id = '{PROTOCOL_ID}';"
    )


def main() -> int:
    writes: list[str] = []
    before = row()
    print(f"before          : {before}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1200})
        page.on(
            "request",
            lambda r: writes.append(f"{r.method} {r.url}")
            if r.method in ("PUT", "PATCH", "POST") and "/protocols/" in r.url
            else None,
        )

        login(page)
        page.goto(f"{BASE_URL}/{LOCALE}/platform/workbooks/{WORKBOOK_ID}")
        page.wait_for_load_state("networkidle")

        toggle = page.locator('[data-testid="json-format-toggle"]').first
        toggle.wait_for(timeout=20_000)
        page.wait_for_timeout(1500)
        writes.clear()  # ignore anything the page did while loading

        page.screenshot(path=f"{OUT}/09-workbook-cell-compact.png")
        toggle.click()
        page.wait_for_timeout(4000)  # well past the 1000ms autosave debounce
        page.screenshot(path=f"{OUT}/10-workbook-cell-expanded.png")

        toggle.click()
        page.wait_for_timeout(4000)
        browser.close()

    after = row()
    print(f"after 2 toggles : {after}")
    print(f"protocol writes : {writes or 'none'}")

    ok = after == before and not writes
    print(f"\n{'PASS' if ok else 'FAIL'}  reflow did not touch the server")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
