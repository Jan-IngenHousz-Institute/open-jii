"""Screenshot a real protocol's JSON in both compact and expanded layouts.

Drives the format toggle in the protocol viewer header and reports the line
count the header itself shows, so the numbers in the screenshots are the app's,
not ours.

Usage: python3 shot_json_layout.py [protocol-id]
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

from playwright.sync_api import sync_playwright

from helpers import BASE_URL, LOCALE, PG_CONTAINER, PG_DB, PG_USER, login

OUT = os.environ.get("E2E_OUT", "/tmp/e2e-json-layout")
VIEWPORT = {"width": 1600, "height": 1100}


def protocol_id() -> str:
    if len(sys.argv) > 1:
        return sys.argv[1]
    out = subprocess.check_output(
        [
            "podman", "exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-tAc",
            "SELECT id FROM protocols ORDER BY length(code::text) DESC LIMIT 1;",
        ],
        text=True,
    )
    return out.strip()


def header_stats(page) -> str:
    """The '<n> lines - <size>' string the viewer header renders."""
    return page.locator("text=/^\\d+ lines - /").first.inner_text().strip()


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    pid = protocol_id()
    print(f"protocol: {pid}")

    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT)

        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error"
            else None,
        )

        login(page)
        page.goto(f"{BASE_URL}/{LOCALE}/platform/protocols/{pid}")
        page.wait_for_load_state("networkidle")
        page.locator('[data-testid="json-viewer-wrapper"]').first.wait_for(timeout=15_000)
        page.wait_for_timeout(500)

        toggle = page.locator('[data-testid="json-format-toggle"]').first
        toggle.wait_for(timeout=10_000)

        # The stored preference defaults to compact, so this is the first shot.
        compact = header_stats(page)
        page.screenshot(path=f"{OUT}/01-compact.png", full_page=False)
        print(f"compact:  {compact}  [aria-label] {toggle.get_attribute('aria-label')}")

        toggle.click()
        page.wait_for_timeout(600)
        expanded = header_stats(page)
        page.screenshot(path=f"{OUT}/02-expanded.png", full_page=False)
        print(f"expanded: {expanded}  [aria-label] {toggle.get_attribute('aria-label')}")

        # Toggle back, and prove the preference survives a reload.
        toggle.click()
        page.wait_for_timeout(400)
        back = header_stats(page)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.locator('[data-testid="json-viewer-wrapper"]').first.wait_for(timeout=15_000)
        page.wait_for_timeout(500)
        after_reload = header_stats(page)
        page.screenshot(path=f"{OUT}/03-compact-after-reload.png", full_page=False)
        print(f"back:     {back}\nreloaded: {after_reload}")

        browser.close()

    def lines(stat: str) -> int:
        return int(re.match(r"(\d+) lines", stat).group(1))

    ok = True
    if lines(compact) >= lines(expanded):
        print(f"FAIL compact ({compact}) is not shorter than expanded ({expanded})")
        ok = False
    if back != compact or after_reload != compact:
        print(f"FAIL preference did not round-trip: {compact} -> {back} -> {after_reload}")
        ok = False

    noise = ("databricks", "contentful", "Failed to load resource", "401", "500")
    real = [e for e in errors if not any(n.lower() in e.lower() for n in noise)]
    if real:
        print("FAIL unexpected runtime errors:")
        for e in real[:10]:
            print(f"  {e}")
        ok = False

    ratio = lines(expanded) / lines(compact)
    print(f"\n{'PASS' if ok else 'FAIL'}  {expanded} -> {compact}  ({ratio:.1f}x fewer lines)")
    print(f"screenshots in {OUT}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
