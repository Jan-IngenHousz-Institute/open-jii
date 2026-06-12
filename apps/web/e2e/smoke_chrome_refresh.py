#!/usr/bin/env python3
"""
Chrome-refresh smoke test (OJD-1510): drives the real platform UI end to end and
checks the navigation shell — sidebar, command palette, keyboard shortcuts,
breadcrumbs, activity bell, settings tabs — plus the page container.

Assumes the local stack is already running (see README.md). Run with:

    cd apps/web/e2e && python3 smoke_chrome_refresh.py

Exits non-zero if any check fails or the page throws an unexpected runtime error.
Screenshots land in $E2E_OUT (default /tmp/e2e-chrome-refresh).
"""

from __future__ import annotations

import os
import re
import sys

from playwright.sync_api import sync_playwright

from helpers import BASE_URL, LOCALE, login, seed_experiment_id

OUT = os.environ.get("E2E_OUT", "/tmp/e2e-chrome-refresh")
os.makedirs(OUT, exist_ok=True)

# Databricks creds are expired locally and Contentful preview can 404 — these are
# expected and must NOT fail the run. Anything else (React render crash, hydration
# error, undefined access) is a real problem.
EXPECTED_ERROR = re.compile(
    r"(Failed to load resource|404|500|Databricks|Contentful|metadata|net::ERR)", re.I
)

results: list[tuple[str, bool, str]] = []


def check(name: str, fn) -> None:
    try:
        detail = fn() or ""
        results.append((name, True, str(detail)))
        print(f"  PASS  {name}  {detail}")
    except Exception as e:  # noqa: BLE001 - smoke wants every failure captured, not the first
        results.append((name, False, repr(e)))
        print(f"  FAIL  {name}  {e!r}")


def main() -> int:
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda exc: page_errors.append(f"pageerror: {exc}"))
        page.on(
            "console",
            lambda m: page_errors.append(f"console.error: {m.text}") if m.type == "error" else None,
        )

        def clear_overlays():
            """Close any open dialog/popover so independent checks don't bleed into each other."""
            page.keyboard.press("Escape")
            page.wait_for_timeout(150)

        # ── Auth (real typed email + OTP from Postgres) ────────────────────
        login(page, BASE_URL)
        page.screenshot(path=f"{OUT}/01-dashboard.png")
        check("dashboard loads", lambda: page.wait_for_url(f"**/{LOCALE}/platform") or page.url)
        check("sidebar nav present", lambda: page.get_by_role("navigation").first.wait_for() or "ok")

        # ── Sidebar collapse/expand (Ctrl/Cmd+B) ───────────────────────────
        def sidebar_toggle():
            root = page.locator("[data-state]").first
            before = root.get_attribute("data-state")
            page.keyboard.press("Control+b")
            page.wait_for_timeout(400)
            after = root.get_attribute("data-state")
            assert before != after, f"data-state unchanged ({before})"
            page.keyboard.press("Control+b")
            page.wait_for_timeout(300)
            return f"{before} -> {after}"

        check("sidebar collapses on Ctrl+B", sidebar_toggle)

        # ── Command palette (Ctrl/Cmd+K): accessible name + 'Home' label ───
        def command_palette():
            try:
                page.keyboard.press("Control+k")
                dialog = page.get_by_role("dialog", name="Command palette")  # #3 sr-only DialogTitle
                dialog.wait_for(state="visible", timeout=5000)
                # cmdk items expose role=option; #5 renames dashboard entry to "Home"
                home = page.get_by_role("option", name=re.compile(r"^Home"))
                assert home.count() and home.first.is_visible(), "no Home option"
                page.screenshot(path=f"{OUT}/02-command-palette.png")
                return "named 'Command palette', Home present"
            finally:
                clear_overlays()

        check("command palette: accessible name + Home", command_palette)

        # ── Keyboard shortcut: g then e -> experiments ─────────────────────
        def goto_experiments_shortcut():
            clear_overlays()
            page.locator("body").click(position={"x": 5, "y": 5})
            page.keyboard.press("g")
            page.keyboard.press("e")
            page.wait_for_url(f"**/{LOCALE}/platform/experiments", timeout=8000)
            page.wait_for_load_state("networkidle")
            return page.url

        check("g-e navigates to experiments", goto_experiments_shortcut)

        # ── Breadcrumbs with leading section icon (#7) ─────────────────────
        def breadcrumbs():
            nav = page.get_by_role("navigation", name="breadcrumb")
            nav.wait_for(state="visible", timeout=5000)
            icons = nav.locator("svg").count()
            page.screenshot(path=f"{OUT}/03-breadcrumbs.png")
            assert icons >= 1, "no breadcrumb icon"
            return f"text={nav.inner_text()!r}, {icons} icon(s)"

        check("breadcrumb renders with section icon", breadcrumbs)

        # ── Activity bell popover (#3 pending pill, #8 open event) ──────────
        def activity_bell():
            clear_overlays()
            bell = page.get_by_role("button", name=re.compile(r"^Activity"))
            bell.wait_for(state="visible", timeout=5000)
            bell.click()
            page.get_by_role("heading", name="Activity").wait_for(state="visible", timeout=5000)
            page.screenshot(path=f"{OUT}/04-activity-bell.png")
            clear_overlays()
            return "popover opened"

        check("activity bell opens", activity_bell)

        # ── Settings tabs: desktop + mobile dropdown ───────────────────────
        def settings_desktop():
            page.goto(f"{BASE_URL}/{LOCALE}/platform/account/settings")
            page.wait_for_load_state("networkidle")
            page.get_by_role("tab").first.wait_for(state="visible", timeout=5000)
            page.screenshot(path=f"{OUT}/05-settings-desktop.png")
            return f"{page.get_by_role('tab').count()} desktop tabs"

        check("settings desktop tabs render", settings_desktop)

        def settings_mobile():
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(400)
            trigger = page.get_by_role("button", name=re.compile("mobileNav|Settings|account", re.I))
            trigger.first.wait_for(state="visible", timeout=5000)
            page.screenshot(path=f"{OUT}/06-settings-mobile.png")
            page.set_viewport_size({"width": 1440, "height": 900})
            return "mobile dropdown trigger visible"

        check("settings mobile dropdown renders", settings_mobile)

        # ── Experiment detail + data page (PageContainer wrapper, #2/#9) ───
        exp_id = seed_experiment_id()

        def experiment_detail():
            page.goto(f"{BASE_URL}/{LOCALE}/platform/experiments/{exp_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("navigation", name="breadcrumb").wait_for(state="visible", timeout=8000)
            page.screenshot(path=f"{OUT}/07-experiment-detail.png")
            return f"breadcrumb={page.get_by_role('navigation', name='breadcrumb').inner_text()!r}"

        check("experiment detail renders (breadcrumb + chrome)", experiment_detail)

        def experiment_data_page():
            # Databricks is down locally, so the table won't load — but the
            # PageContainer chrome + tabs/empty-state must render without crashing.
            page.goto(f"{BASE_URL}/{LOCALE}/platform/experiments/{exp_id}/data")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            crashed = page.locator("text=/Application error|Unhandled Runtime Error/").count()
            page.screenshot(path=f"{OUT}/08-experiment-data.png")
            assert crashed == 0, "Next.js runtime error overlay present"
            return "no runtime crash"

        check("experiment data page chrome renders (no crash)", experiment_data_page)

        context.close()
        browser.close()

    # ── Summary ────────────────────────────────────────────────────────────
    unexpected = [e for e in page_errors if not EXPECTED_ERROR.search(e)]
    print("\n=== page/console errors ===")
    print(f"  total={len(page_errors)}  expected(noise)={len(page_errors) - len(unexpected)}")
    for e in unexpected:
        print("  UNEXPECTED:", e)

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n=== {passed}/{len(results)} checks passed ===")
    failed = [n for n, ok, _ in results if not ok]
    if failed:
        print("FAILED:", ", ".join(failed))
    if unexpected:
        print("UNEXPECTED RUNTIME ERRORS:", len(unexpected))
    print(f"screenshots in {OUT}")
    return 1 if (failed or unexpected) else 0


if __name__ == "__main__":
    sys.exit(main())
