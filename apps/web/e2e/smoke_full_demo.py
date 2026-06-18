"""Full IAM demo (OJD-1638) in one continuous, paced flow + video, for docs.

As the seed user (a platform admin and org owner), walks the whole journey:
  1. log in
  2. personal organization in the topbar switcher
  3. platform admin console (users + role/ban/impersonate controls)
  4. organization settings -> invite a teammate -> pending invitation
  5. share each entity type with a teammate via the generalized sharing panel:
     experiment, macro, protocol, workbook

Paced with slow_mo so the recording is watchable (~40s+). Run after the local
stack + seed are up:
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
SLOW_MO_MS = 600
PAUSE_MS = 1200


def step(msg: str) -> None:
    print(f"  → {msg}")


def share_entity(page, url: str, what: str) -> None:
    """Open an entity page, share it with a teammate via the Sharing panel."""
    page.goto(url)
    page.wait_for_load_state("networkidle")
    region = page.get_by_role("region", name="Sharing")
    region.scroll_into_view_if_needed()
    region.wait_for(state="visible", timeout=10_000)
    search = page.get_by_label("Search people to share with")
    search.wait_for(state="visible", timeout=10_000)
    search.fill("Participant")
    page.get_by_role("button", name="Share").first.click()
    page.get_by_role("button", name=re.compile("^Remove access for")).first.wait_for(
        state="visible", timeout=10_000
    )
    page.wait_for_timeout(PAUSE_MS)
    step(f"shared {what}")


def main() -> int:
    workbook_id = helpers.seed_workbook_id()
    macro_id = helpers.seed_macro_id()
    protocol_id = helpers.seed_protocol_id()
    experiment_id = helpers.seed_experiment_id()
    missing = [
        name
        for name, value in [
            ("workbook", workbook_id),
            ("macro", macro_id),
            ("protocol", protocol_id),
            ("experiment", experiment_id),
        ]
        if not value
    ]
    if missing:
        print(f"FAIL: seed is missing {', '.join(missing)} (run db:seed)", file=sys.stderr)
        return 1

    with sync_playwright() as p:
        browser, context, page = helpers.start_recording(p, "full_demo", slow_mo=SLOW_MO_MS)
        try:
            # 1. Log in.
            helpers.login(page)
            page.wait_for_timeout(PAUSE_MS)
            step("logged in")

            # 2. Personal org in the switcher.
            switcher = page.get_by_role("button", name="Switch organization")
            switcher.wait_for(state="visible", timeout=10_000)
            switcher.click()  # open the dropdown to show the org
            page.get_by_role("menuitem").first.wait_for(state="visible", timeout=5_000)
            page.wait_for_timeout(PAUSE_MS)
            page.keyboard.press("Escape")
            step(f"org switcher shows '{switcher.inner_text().strip()}'")

            # 3. Platform admin console.
            page.goto(f"{BASE}/{LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")
            page.get_by_role("region", name="Platform admin").wait_for(state="visible", timeout=10_000)
            page.get_by_text("participant1@openjii.local").wait_for(state="visible", timeout=10_000)
            page.get_by_role("button", name=re.compile("^Impersonate ")).first.wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            step("admin console lists users with controls")

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
            page.wait_for_timeout(PAUSE_MS)
            step(f"invited {INVITEE} -> pending invitation shown")

            # 5. Share every entity type via the generalized sharing panel.
            share_entity(
                page,
                f"{BASE}/{LOCALE}/platform/experiments/{experiment_id}/collaborators",
                "an experiment",
            )
            share_entity(page, f"{BASE}/{LOCALE}/platform/macros/{macro_id}", "a macro")
            share_entity(page, f"{BASE}/{LOCALE}/platform/protocols/{protocol_id}", "a protocol")
            share_entity(page, f"{BASE}/{LOCALE}/platform/workbooks/{workbook_id}", "a workbook")

            page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo.png")
            print("PASS: full IAM demo (login → org → admin → invite → share x4 entities)")
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
