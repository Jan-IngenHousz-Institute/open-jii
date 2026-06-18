"""Full IAM demo (OJD-1638) in one continuous flow + video, for docs.

Walks the whole journey as the seed user (a platform admin and org owner):
  1. log in
  2. see the personal organization in the topbar switcher
  3. open the platform admin console (users + role/ban/impersonate controls)
  4. open organization settings, invite a teammate -> pending invitation
  5. open a private workbook and share it with a teammate -> grant appears

Run after the local stack + seed are up:
    cd apps/web/e2e && python3 smoke_full_demo.py
Records artifacts/videos/full_demo.webm.
"""

from __future__ import annotations

import re
import sys

from playwright.sync_api import sync_playwright

import helpers

BASE = helpers.BASE_URL
LOCALE = helpers.LOCALE
INVITEE = "newhire@openjii.local"


def step(page, msg: str) -> None:
    print(f"  → {msg}")


def main() -> int:
    workbook_id = helpers.seed_workbook_id()
    if not workbook_id:
        print("FAIL: no seed workbook found (run db:seed)", file=sys.stderr)
        return 1

    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "full_demo")
        try:
            # 1. Log in.
            helpers.login(page)
            step(page, "logged in")

            # 2. Personal org in the switcher.
            switcher = page.get_by_role("button", name="Switch organization")
            switcher.wait_for(state="visible", timeout=10_000)
            assert "workspace" in switcher.inner_text().lower()
            step(page, f"org switcher shows '{switcher.inner_text().strip()}'")

            # 3. Platform admin console.
            page.goto(f"{BASE}/{LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")
            page.get_by_role("region", name="Platform admin").wait_for(state="visible", timeout=10_000)
            page.get_by_text("participant1@openjii.local").wait_for(state="visible", timeout=10_000)
            page.get_by_role("button", name=re.compile("^Impersonate ")).first.wait_for(
                state="visible", timeout=10_000
            )
            step(page, "admin console lists users with controls")

            # 4. Organization settings -> invite a teammate.
            page.goto(f"{BASE}/{LOCALE}/platform/account/organization")
            page.wait_for_load_state("networkidle")
            page.get_by_role("region", name="Organization members").wait_for(
                state="visible", timeout=10_000
            )
            email = page.get_by_label("Invite email")
            email.wait_for(state="visible", timeout=10_000)
            email.fill(INVITEE)
            page.get_by_role("button", name="Invite").click()
            page.get_by_role(
                "button", name=re.compile(rf"Cancel invitation for {re.escape(INVITEE)}")
            ).wait_for(state="visible", timeout=10_000)
            step(page, f"invited {INVITEE} -> pending invitation shown")

            # 5. Share a workbook with a teammate.
            page.goto(f"{BASE}/{LOCALE}/platform/workbooks/{workbook_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("region", name="Sharing").wait_for(state="visible", timeout=10_000)
            search = page.get_by_label("Search people to share with")
            search.wait_for(state="visible", timeout=10_000)
            search.fill("Participant")
            page.get_by_role("button", name="Share").first.click()
            page.get_by_role("button", name=re.compile("^Remove access for")).first.wait_for(
                state="visible", timeout=10_000
            )
            step(page, "shared the workbook -> grant shown")

            page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo.png")
            print("PASS: full IAM demo (login → org → admin → invite → share)")
            return 0
        except Exception as err:  # noqa: BLE001
            print(f"FAIL: {err}", file=sys.stderr)
            try:
                page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo_FAIL.png")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            path = helpers.finish_recording(page, context, browser, "full_demo")
            if path:
                print(f"video: {path}")


if __name__ == "__main__":
    sys.exit(main())
