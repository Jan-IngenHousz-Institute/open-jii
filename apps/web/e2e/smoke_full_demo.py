"""Full IAM + organizations demo (OJD-1638) in one continuous, paced flow + video.

A wide tour, as the seed user (an org owner), of everything the access-control
work adds:

  1. log in (email-OTP)
  2. create a brand-new organization (name -> live slug check -> type -> visibility)
  3. browse + search the public organization directory
  4. open the public "Community" org -> see its public resources -> request to join
  5. switch the active organization to the owned "Photosynthesis Lab"
  6. manage the owned org:
       Members  -> invite by email, change a member's role, cancel the invite
       Teams    -> create a team, see the seeded Imaging team
       Requests -> approve one pending join request, reject the other
  7. each resource gets a GitHub-style "Collaborators and teams" tab:
       macro     -> see an Outside Collaborator, Add people, re-role, remove,
                    then the read-only Organization access tab
       protocol  -> Add a team        experiment / workbook -> Add people

Paced with slow_mo so the recording is watchable (~2-3 min). Run after the local
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
SLOW_MO_MS = 700
PAUSE_MS = 1400


def step(msg: str) -> None:
    print(f"  → {msg}")


def pick_radix_option(page, label: str, option_re: str) -> None:
    """Open a Radix Select by its trigger aria-label and click a matching option."""
    page.get_by_role("combobox", name=label).click()
    page.get_by_role("option", name=re.compile(option_re)).first.click()


def collab_region(page, url: str):
    """Open a resource's Collaborators tab and return the GitHub-style region."""
    page.goto(url)
    page.wait_for_load_state("networkidle")
    region = page.get_by_role("region", name="Collaborators and teams")
    region.scroll_into_view_if_needed()
    region.wait_for(state="visible", timeout=10_000)
    return region


def add_person(region, page, what: str) -> None:
    region.get_by_role("button", name="Add people").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible", timeout=10_000)
    # UserSearchPopover: type to search, then pick a result (rendered in a portal).
    dialog.get_by_placeholder(re.compile("Search people by name or email")).fill("Participant")
    page.get_by_role("button", name=re.compile("Participant")).first.click()
    page.wait_for_timeout(300)
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"added a person to {what}")


def add_team(region, page, team: str, what: str) -> None:
    region.get_by_role("button", name="Add teams").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible", timeout=10_000)
    dialog.get_by_text(team).first.click()
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"added the {team} team to {what}")


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
            pick_radix_option(page, "Organization type", "University")
            pick_radix_option(page, "Organization visibility", "Public")
            create_btn = page.get_by_role("button", name="Create organization")
            for _ in range(20):
                if create_btn.is_enabled():
                    break
                page.wait_for_timeout(300)
            page.wait_for_timeout(PAUSE_MS)
            create_btn.click()
            page.wait_for_url(re.compile(r"/platform/organizations/[0-9a-f-]{36}"), timeout=15_000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(PAUSE_MS)
            step(f"created organization '{new_org_name}' (University, Public)")

            # 3. Browse + search the directory.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Organizations").wait_for(state="visible", timeout=10_000)
            page.get_by_label("Search organizations").fill("Community")
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_text("Community", exact=True).first.wait_for(state="visible", timeout=10_000)
            step("searched the organization directory")

            # 4. Open Community, see its resources, request to join.
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
            page.wait_for_timeout(PAUSE_MS)

            # 5. Switch the active org to the owned Photosynthesis Lab.
            switcher = page.get_by_role("button", name="Switch organization")
            switcher.click()
            page.get_by_role("menuitem", name=re.compile("Photosynthesis Lab")).click()
            page.wait_for_timeout(PAUSE_MS)
            step("switched active org to Photosynthesis Lab")

            # 6. Manage the owned org.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations/{owned_org_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Photosynthesis Lab").wait_for(
                state="visible", timeout=10_000
            )
            page.get_by_role("tab", name="Members").click()
            invite_email = "newhire@openjii.local"
            page.get_by_label("Invite email").fill(invite_email)
            page.get_by_role("button", name="Invite").click()
            page.get_by_label(f"Cancel invitation for {invite_email}").wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_label("Role for bob@openjii.local").select_option("admin")
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_label(f"Cancel invitation for {invite_email}").click()
            page.wait_for_timeout(PAUSE_MS)
            step("invited a teammate, promoted bob, cancelled the invite")

            page.get_by_role("tab", name="Teams").click()
            page.get_by_text("Imaging").first.wait_for(state="visible", timeout=10_000)
            page.get_by_label("New team name").fill("Analysis")
            page.get_by_role("button", name="Create team").click()
            page.get_by_text("Analysis").first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            step("created the Analysis team")

            page.get_by_role("tab", name="Requests").click()
            approve = page.get_by_role("button", name=re.compile("^Approve "))
            if approve.count():
                approve.first.click()
                page.wait_for_timeout(PAUSE_MS)
                step("approved a join request")
            reject = page.get_by_role("button", name=re.compile("^Reject "))
            if reject.count():
                reject.first.click()
                page.wait_for_timeout(PAUSE_MS)
                step("rejected a join request")

            # 7. Per-resource "Collaborators and teams" tabs.
            # Macro: cards + Direct access (an Outside Collaborator) + add/re-role/remove + Org access tab.
            region = collab_region(page, f"{BASE}/{LOCALE}/platform/macros/{macro_id}/collaborators")
            page.get_by_text("Outside Collaborator").first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            step("opened the macro Collaborators tab (Outside Collaborator visible)")
            add_person(region, page, "the macro")
            role_ctl = region.get_by_role("combobox", name=re.compile("^Role for ")).first
            role_ctl.click()
            page.get_by_role("option", name="viewer").first.click()
            page.wait_for_timeout(PAUSE_MS)
            step("changed a collaborator's role to viewer")
            region.get_by_role("button", name=re.compile("^Remove access for ")).first.click()
            page.wait_for_timeout(PAUSE_MS)
            step("removed a collaborator")
            region.get_by_role("tab", name=re.compile("Organization access")).click()
            page.wait_for_timeout(PAUSE_MS)
            step("viewed the Organization access tab")

            # Protocol: add a team.
            region = collab_region(
                page, f"{BASE}/{LOCALE}/platform/protocols/{protocol_id}/collaborators"
            )
            add_team(region, page, "Imaging", "the protocol")

            # Experiment + workbook: add a person.
            region = collab_region(
                page, f"{BASE}/{LOCALE}/platform/experiments/{experiment_id}/collaborators"
            )
            add_person(region, page, "the experiment")
            region = collab_region(
                page, f"{BASE}/{LOCALE}/platform/workbooks/{workbook_id}/collaborators"
            )
            add_person(region, page, "the workbook")

            page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo.png")
            print(
                "PASS: full IAM + orgs demo "
                "(login → create → browse → join → switch → manage → collaborators x4)"
            )
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
