"""Full IAM + organizations demo (OJD-1638) in one continuous, paced flow + video.

A wide tour, as the seed user (platform admin + org owner), of everything the
access-control work adds:

  1. log in (email-OTP)
  2. platform admin console — change a user's global role, ban + unban a user
  3. create a brand-new organization (name -> live slug check -> type -> visibility)
  4. browse + search the public organization directory
  5. open the public "Community" org -> see its public resources -> request to join
  6. switch the active organization to the owned "Photosynthesis Lab"
  7. manage the owned org:
       Members  -> invite by email, change a member's role, cancel the invite
       Teams    -> create a team, see the seeded Imaging team
       Requests -> approve one pending join request, reject the other
  8. share resources via the unified collaborators panel:
       experiment -> a person (Admin)      macro    -> a person, then re-role to Viewer
       protocol   -> an organization        workbook -> the Imaging team
  9. impersonate a participant and confirm the session really switched (no admin access)

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
SLOW_MO_MS = 750
PAUSE_MS = 1500


def step(msg: str) -> None:
    print(f"  → {msg}")


def pick_radix_option(page, label: str, option_re: str) -> None:
    """Open a Radix Select by its trigger aria-label and click a matching option."""
    page.get_by_role("combobox", name=label).click()
    page.get_by_role("option", name=re.compile(option_re)).first.click()


def open_collaborators(page, url: str):
    page.goto(url)
    page.wait_for_load_state("networkidle")
    region = page.get_by_role("region", name="Collaborators")
    region.scroll_into_view_if_needed()
    region.wait_for(state="visible", timeout=10_000)
    region.get_by_role("button", name="Share").click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible", timeout=10_000)
    return region, dialog


def share_with_person(page, url: str, what: str, role: str | None = None) -> None:
    region, dialog = open_collaborators(page, url)
    dialog.get_by_label("Search people to share with").fill("Participant")
    dialog.get_by_role("button", name=re.compile("Participant")).first.click()
    if role:
        dialog.get_by_role("combobox", name="Role to grant").click()
        page.get_by_role("option", name=role).first.click()
    page.wait_for_timeout(300)
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"shared {what} with a person{f' as {role}' if role else ''}")


def share_with_picker(page, url: str, mode: str, label: str, what: str) -> None:
    """Share with a Team or Organization picked from the dialog list."""
    region, dialog = open_collaborators(page, url)
    dialog.get_by_role("button", name=mode).click()
    page.wait_for_timeout(400)
    dialog.get_by_text(label).first.click()
    dialog.get_by_role("button", name="Share").click()
    dialog.wait_for(state="hidden", timeout=10_000)
    page.wait_for_timeout(PAUSE_MS)
    step(f"shared {what} with {mode.lower()} '{label}'")


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

            # 2. Platform admin console: role change + ban/unban.
            page.goto(f"{BASE}/{LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")
            page.get_by_role("region", name="Platform admin").wait_for(state="visible", timeout=10_000)
            page.get_by_text("participant1@openjii.local").wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_label("Role for participant2@openjii.local").select_option("admin")
            page.wait_for_timeout(PAUSE_MS)
            step("granted participant2 the admin role")
            page.get_by_role("button", name="Ban participant4@openjii.local").click()
            page.get_by_role("button", name="Unban participant4@openjii.local").wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_role("button", name="Unban participant4@openjii.local").click()
            page.get_by_role("button", name="Ban participant4@openjii.local").wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            step("banned then unbanned participant4")

            # 3. Create a brand-new organization.
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

            # 4. Browse + search the directory.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Organizations").wait_for(state="visible", timeout=10_000)
            search = page.get_by_label("Search organizations")
            search.fill("Community")
            page.wait_for_timeout(PAUSE_MS)
            page.get_by_text("Community", exact=True).first.wait_for(state="visible", timeout=10_000)
            step("searched the organization directory")

            # 5. Open Community, see its resources, request to join.
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

            # 6. Switch the active org to the owned Photosynthesis Lab.
            switcher = page.get_by_role("button", name="Switch organization")
            switcher.click()
            page.get_by_role("menuitem", name=re.compile("Photosynthesis Lab")).click()
            page.wait_for_timeout(PAUSE_MS)
            step("switched active org to Photosynthesis Lab")

            # 7. Manage the owned org.
            page.goto(f"{BASE}/{LOCALE}/platform/organizations/{owned_org_id}")
            page.wait_for_load_state("networkidle")
            page.get_by_role("heading", name="Photosynthesis Lab").wait_for(
                state="visible", timeout=10_000
            )

            # 7a. Members: invite, change a role, cancel the invite.
            page.get_by_role("tab", name="Members").click()
            invite_email = "newhire@openjii.local"
            page.get_by_label("Invite email").fill(invite_email)
            page.get_by_role("button", name="Invite").click()
            page.get_by_label(f"Cancel invitation for {invite_email}").wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            step(f"invited {invite_email}")
            page.get_by_label("Role for bob@openjii.local").select_option("admin")
            page.wait_for_timeout(PAUSE_MS)
            step("promoted bob to admin")
            page.get_by_label(f"Cancel invitation for {invite_email}").click()
            page.wait_for_timeout(PAUSE_MS)
            step("cancelled the pending invite")

            # 7b. Teams: create one, see the seeded Imaging team.
            page.get_by_role("tab", name="Teams").click()
            page.get_by_text("Imaging").first.wait_for(state="visible", timeout=10_000)
            page.get_by_label("New team name").fill("Analysis")
            page.get_by_role("button", name="Create team").click()
            page.get_by_text("Analysis").first.wait_for(state="visible", timeout=10_000)
            page.wait_for_timeout(PAUSE_MS)
            step("created the Analysis team (alongside Imaging)")

            # 7c. Requests: approve one, reject the other.
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

            # 8. Share resources via the unified collaborators panel.
            share_with_person(
                page,
                f"{BASE}/{LOCALE}/platform/experiments/{experiment_id}/collaborators",
                "an experiment",
                role="Admin",
            )
            # macro: share with a person, then re-role that grant to Viewer.
            share_with_person(page, f"{BASE}/{LOCALE}/platform/macros/{macro_id}", "a macro")
            region = page.get_by_role("region", name="Collaborators")
            role_ctl = region.get_by_role("combobox", name=re.compile("^Role for ")).first
            role_ctl.click()
            page.get_by_role("option", name="Viewer").first.click()
            page.wait_for_timeout(PAUSE_MS)
            step("changed the macro grant's role to Viewer")

            share_with_picker(
                page,
                f"{BASE}/{LOCALE}/platform/protocols/{protocol_id}",
                "Organization",
                "Photosynthesis Lab",
                "a protocol",
            )
            share_with_picker(
                page,
                f"{BASE}/{LOCALE}/platform/workbooks/{workbook_id}",
                "Team",
                "Imaging",
                "a workbook",
            )

            # 9. Impersonate a participant; confirm the session actually switched.
            page.goto(f"{BASE}/{LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")
            page.get_by_role("button", name="Impersonate participant1@openjii.local").first.click()
            page.wait_for_timeout(PAUSE_MS)
            page.goto(f"{BASE}/{LOCALE}/platform/admin")
            page.wait_for_load_state("networkidle")
            page.get_by_text("You do not have platform admin access.").wait_for(
                state="visible", timeout=10_000
            )
            page.wait_for_timeout(PAUSE_MS)
            step("impersonated participant1 (admin console now denies access)")

            page.screenshot(path=f"{helpers.VIDEO_DIR}/full_demo.png")
            print(
                "PASS: full IAM + orgs demo "
                "(login → admin → create → browse → join → switch → manage → share → impersonate)"
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
