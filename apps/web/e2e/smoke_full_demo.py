"""Full IAM + organizations demo (OJD-1638) in one continuous, paced flow + video.

As the seed user (a platform admin and org owner), walks the whole journey:
  1. log in
  2. create a brand-new organization (name -> live slug check -> visibility)
  3. browse the public organization directory
  4. open the public "Community" org -> see its public resources -> request to join
  5. switch the active organization to the owned "Photosynthesis Lab"
  6. open the owned org -> Teams (the Imaging team) -> Requests -> approve a pending one
  7. share each entity via the unified collaborators UI:
     experiment, macro, protocol (with a person) and a workbook (with a team)

Paced with slow_mo so the recording is watchable (~60-75s). Run after the local
stack + seed are up:
    cd apps/web/e2e && python3 smoke_full_demo.py
Records artifacts/videos/full_demo.webm.
"""

from __future__ import annotations

import re
import sys
import time

from playwright.sync_api import sync_playwright

import helpers

BASE = helpers.BASE_URL
LOCALE = helpers.LOCALE
SLOW_MO_MS = 550
PAUSE_MS = 1100


def step(msg: str) -> None:
    print(f"  → {msg}")


def share_with_person(page, url: str, what: str) -> None:
    """Open an entity page and share it with a person via the collaborators panel."""
    page.goto(url)
    page.wait_for_load_state("networkidle")
    region = page.get_by_role("region", name="Collaborators")
    region.scroll_into_view_if_needed()
    region.wait_for(state="visible", timeout=10_000)
    region.get_by_role("button", name="Share").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible", timeout=10_000)
    dialog.get_by_label("Search people to share with").fill("Participant")
    dialog.get_by_role("button", name=re.compile("Participant")).first.click()
    page.wait_for_timeout(400)
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"shared {what} with a person")


def share_with_team(page, url: str, what: str) -> None:
    """Share an entity with the active org's Imaging team."""
    page.goto(url)
    page.wait_for_load_state("networkidle")
    region = page.get_by_role("region", name="Collaborators")
    region.scroll_into_view_if_needed()
    region.wait_for(state="visible", timeout=10_000)
    region.get_by_role("button", name="Share").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible", timeout=10_000)
    dialog.get_by_role("button", name="Team").click()
    page.wait_for_timeout(400)
    dialog.get_by_text("Imaging").first.click()
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"shared {what} with the Imaging team")


def main() -> int:
    workbook_id = helpers.seed_workbook_id()
    macro_id = helpers.seed_macro_id()
    protocol_id = helpers.seed_protocol_id()
    experiment_id = helpers.seed_experiment_id()
    public_org_id = helpers.seed_public_org_id()
    owned_org_id = helpers.seed_owned_org_id()
    missing = [
        name
        for name, value in [
            ("workbook", workbook_id),
            ("macro", macro_id),
            ("protocol", protocol_id),
            ("experiment", experiment_id),
            ("public org", public_org_id),
            ("owned org", owned_org_id),
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

            # 2. Create a brand-new organization.
            unique = str(int(time.time()) % 100000)
            new_org_name = f"Demo Lab {unique}"
            page.goto(f"{BASE}/{LOCALE}/platform/organizations/new")
            page.wait_for_load_state("networkidle")
            page.get_by_label("Name").fill(new_org_name)
            # Wait for the live slug check to settle to "available".
            create_btn = page.get_by_role("button", name="Create organization")
            for _ in range(20):
                if create_btn.is_enabled():
                    break
                page.wait_for_timeout(300)
            page.get_by_label("Organization visibility").click()
            page.get_by_role("option", name=re.compile("Public")).click()
            page.wait_for_timeout(PAUSE_MS)
            create_btn.click()
            page.wait_for_url(re.compile(r"/platform/organizations/[0-9a-f-]{36}"), timeout=15_000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(PAUSE_MS)
            step(f"created organization '{new_org_name}'")

            # 3. Browse the public directory.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Organizations").wait_for(state="visible", timeout=10_000)
            page.get_by_text("Community", exact=True).first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            step("browsed the organization directory")

            # 4. Open the public Community org, see its resources, request to join.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations/{public_org_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Community").wait_for(state="visible", timeout=10_000)
            page.get_by_text("Experiments", exact=False).first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            join = page.get_by_role("button", name="Request to join")
            if join.count() and join.first.is_enabled():
                join.first.click()
                page.get_by_role("button", name=re.compile("Requested")).first.wait_for(
                    state="visible", timeout=10_000
                )
                step("requested to join Community")
            else:
                step("already requested to join Community")
            page.wait_for_timeout(PAUSE_MS)

            # 5. Switch the active organization to the owned Photosynthesis Lab.
            switcher = page.get_by_role("button", name="Switch organization")
            switcher.click()
            page.get_by_role("menuitem", name=re.compile("Photosynthesis Lab")).click()
            page.wait_for_timeout(PAUSE_MS)
            step("switched active org to Photosynthesis Lab")

            # 6. Open the owned org: Teams + Requests (approve a pending one).
            page.goto(f"{BASE}/{LOCALE}/platform/organizations/{owned_org_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Photosynthesis Lab").wait_for(
                state="visible", timeout=10_000
            )
            page.get_by_role("tab", name="Teams").click()
            page.get_by_text("Imaging").first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            step("viewed the Imaging team")

            page.get_by_role("tab", name="Requests").click()
            approve = page.get_by_role("button", name=re.compile("^Approve "))
            if approve.count():
                approve.first.click()
                page.wait_for_timeout(PAUSE_MS)
                step("approved a pending join request")
            else:
                step("no pending join requests to approve")
            page.wait_for_timeout(PAUSE_MS)

            # 7. Share each entity via the unified collaborators UI.
            share_with_person(
                page,
                f"{BASE}/{LOCALE}/platform/experiments/{experiment_id}/collaborators",
                "an experiment",
            )
            share_with_person(page, f"{BASE}/{LOCALE}/platform/macros/{macro_id}", "a macro")
            share_with_person(page, f"{BASE}/{LOCALE}/platform/protocols/{protocol_id}", "a protocol")
            share_with_team(page, f"{BASE}/{LOCALE}/platform/workbooks/{workbook_id}", "a workbook")

            page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo.png")
            print("PASS: full IAM + orgs demo (create → browse → join → switch → teams → approve → share)")
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
