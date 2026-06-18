"""P3 sharing smoke (OJD-1638): the owner of a private workbook shares it with
another user through the generalized ResourceSharing panel.

Run after the local stack + seed are up (the seed creates a private workbook):
    cd apps/web/e2e && python3 smoke_sharing.py
Records artifacts/videos/sharing.webm for docs.
"""

from __future__ import annotations

import re
import sys

from playwright.sync_api import sync_playwright

import helpers


def main() -> int:
    workbook_id = helpers.seed_workbook_id()
    if not workbook_id:
        print("FAIL: no seed workbook found (run db:seed)", file=sys.stderr)
        return 1

    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "sharing")
        try:
            helpers.login(page)
            page.goto(
                f"{helpers.BASE_URL}/{helpers.LOCALE}/platform/workbooks/{workbook_id}"
            )
            page.wait_for_load_state("networkidle")

            # The owner sees the Sharing panel with a people search (canShare).
            page.get_by_role("region", name="Sharing").wait_for(state="visible", timeout=10_000)
            search = page.get_by_label("Search people to share with")
            search.wait_for(state="visible", timeout=10_000)
            search.click()
            search.press_sequentially("Participant", delay=20)

            # Share with the first matching person.
            share_btn = page.get_by_role("button", name="Share").first
            share_btn.wait_for(state="visible", timeout=10_000)
            share_btn.click()

            # The grant now shows in the list with a remove control.
            page.get_by_role("button", name=re.compile("^Remove access for")).first.wait_for(
                state="visible", timeout=10_000
            )

            page.screenshot(path=f"{helpers.VIDEO_DIR}/sharing.png")
            print("PASS: shared a workbook via the ResourceSharing panel")
            return 0
        except Exception as err:  # noqa: BLE001
            print(f"FAIL: {err}", file=sys.stderr)
            try:
                page.screenshot(path=f"{helpers.VIDEO_DIR}/sharing_FAIL.png")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            path = helpers.finish_recording(page, context, browser, "sharing")
            if path:
                print(f"video: {path}")


if __name__ == "__main__":
    sys.exit(main())
