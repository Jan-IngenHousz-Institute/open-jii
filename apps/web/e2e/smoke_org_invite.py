"""P4 org-management smoke (OJD-1638): an org owner invites a teammate by email
and the pending invitation appears in the organization settings.

Run after the local stack + seed are up:
    cd apps/web/e2e && python3 smoke_org_invite.py
Records artifacts/videos/org_invite.webm for docs.
"""

from __future__ import annotations

import re
import sys

from playwright.sync_api import sync_playwright

import helpers

INVITEE = "invitee@openjii.local"


def main() -> int:
    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "org_invite")
        try:
            helpers.login(page)
            page.goto(f"{helpers.BASE_URL}/{helpers.LOCALE}/platform/account/organization")
            page.wait_for_load_state("networkidle")

            page.get_by_role("region", name="Organization members").wait_for(
                state="visible", timeout=10_000
            )
            email_input = page.get_by_label("Invite email")
            email_input.wait_for(state="visible", timeout=10_000)
            email_input.click()
            email_input.fill(INVITEE)
            page.get_by_role("button", name="Invite").click()

            # The pending invitation shows with a cancel control.
            page.get_by_role(
                "button", name=re.compile(rf"Cancel invitation for {re.escape(INVITEE)}")
            ).wait_for(state="visible", timeout=10_000)

            page.screenshot(path=f"{helpers.VIDEO_DIR}/org_invite.png")
            print(f"PASS: invited {INVITEE}; pending invitation shown")
            return 0
        except Exception as err:  # noqa: BLE001
            print(f"FAIL: {err}", file=sys.stderr)
            try:
                page.screenshot(path=f"{helpers.VIDEO_DIR}/org_invite_FAIL.png")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            path = helpers.finish_recording(page, context, browser, "org_invite")
            if path:
                print(f"video: {path}")


if __name__ == "__main__":
    sys.exit(main())
