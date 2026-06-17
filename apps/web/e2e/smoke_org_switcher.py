"""P1 smoke (OJD-1638): every user gets a personal organization, shown in the
topbar org switcher and active for the session.

Run after the local stack + seed are up (see README.md):
    cd apps/web/e2e && python3 smoke_org_switcher.py
Records a video to artifacts/videos/org_switcher.webm for docs.
"""

from __future__ import annotations

import sys

from playwright.sync_api import sync_playwright

import helpers


def main() -> int:
    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "org_switcher")
        try:
            helpers.login(page)

            switcher = page.get_by_role("button", name="Switch organization")
            switcher.wait_for(state="visible", timeout=10_000)
            label = switcher.inner_text().strip()
            assert "workspace" in label.lower(), f"unexpected switcher label: {label!r}"

            # Opening it lists at least the personal organization.
            switcher.click()
            page.get_by_role("menuitem").first.wait_for(state="visible", timeout=5_000)
            count = page.get_by_role("menuitem").count()
            assert count >= 1, "expected at least one organization in the switcher"

            page.screenshot(path=f"{helpers.VIDEO_DIR}/org_switcher.png")
            print(f"PASS: org switcher shows '{label}' with {count} org(s)")
            return 0
        except Exception as err:  # noqa: BLE001 - surface any failure as non-zero exit
            print(f"FAIL: {err}", file=sys.stderr)
            try:
                page.screenshot(path=f"{helpers.VIDEO_DIR}/org_switcher_FAIL.png")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            path = helpers.finish_recording(page, context, browser, "org_switcher")
            if path:
                print(f"video: {path}")


if __name__ == "__main__":
    sys.exit(main())
