"""P5 platform-admin smoke (OJD-1638): a platform admin (the seed user) sees the
admin console with the user list and management controls.

Run after the local stack + seed are up (seed user has role=admin):
    cd apps/web/e2e && python3 smoke_admin_console.py
Records artifacts/videos/admin_console.webm for docs.
"""

from __future__ import annotations

import re
import sys

from playwright.sync_api import sync_playwright

import helpers


def main() -> int:
    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "admin_console")
        try:
            helpers.login(page)
            page.goto(f"{helpers.BASE_URL}/{helpers.LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")

            page.get_by_role("region", name="Platform admin").wait_for(
                state="visible", timeout=10_000
            )
            # The user list renders with a participant and management controls.
            page.get_by_text("participant1@openjii.local").wait_for(state="visible", timeout=10_000)
            page.get_by_role("button", name=re.compile("^Impersonate ")).first.wait_for(
                state="visible", timeout=10_000
            )

            page.screenshot(path=f"{helpers.VIDEO_DIR}/admin_console.png")
            print("PASS: platform admin console lists users with controls")
            return 0
        except Exception as err:  # noqa: BLE001
            print(f"FAIL: {err}", file=sys.stderr)
            try:
                page.screenshot(path=f"{helpers.VIDEO_DIR}/admin_console_FAIL.png")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            path = helpers.finish_recording(page, context, browser, "admin_console")
            if path:
                print(f"video: {path}")


if __name__ == "__main__":
    sys.exit(main())
