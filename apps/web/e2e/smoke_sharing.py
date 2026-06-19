"""P3 sharing smoke (OJD-1638): the owner of a private workbook shares it with
another user through the unified ResourceCollaborators panel.

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
                f"{helpers.BASE_URL}/{helpers.LOCALE}/platform/workbooks/{workbook_id}/collaborators"
            )
            page.wait_for_load_state("networkidle")

            # The owner sees the GitHub-style "Collaborators and teams" tab (canShare).
            region = page.get_by_role("region", name="Collaborators and teams")
            region.wait_for(state="visible", timeout=10_000)
            region.get_by_role("button", name="Add people").click()

            # In the dialog, search for and select a person, then share.
            dialog = page.get_by_role("dialog")
            dialog.wait_for(state="visible", timeout=10_000)
            dialog.get_by_placeholder(re.compile("Search people by name or email")).fill("Participant")
            page.get_by_role("button", name=re.compile("Participant")).first.click()
            # Let React register the selection so the Share button enables.
            page.wait_for_timeout(400)
            dialog.get_by_role("button", name="Share").click()

            # The grant now shows as a collaborator with a role control.
            dialog.wait_for(state="hidden", timeout=10_000)
            region.get_by_role("combobox", name=re.compile("^Role for ")).first.wait_for(
                state="visible", timeout=10_000
            )

            page.screenshot(path=f"{helpers.VIDEO_DIR}/sharing.png")
            print("PASS: shared a workbook via the Collaborators and teams tab")
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
