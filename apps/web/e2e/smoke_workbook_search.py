#!/usr/bin/env python3
"""
Attach-workbook search smoke test: drives the real workbook picker and checks that
searching is served by the backend's full-text search rather than filtered in the
browser: name matching, creator matching, linked-experiment matching, server
ranking, plus the in-flight and held-over-results states.

Why this exists: the picker used to filter cmdk's fuzzy match over `name + uuid`
client-side, so a uuid's hex characters satisfied most queries and the list barely
narrowed (a single digit matched everything). The regression this guards is a
*silent* one (results still appear, just the wrong ones), so the decisive checks
below search for terms that appear nowhere in the matching workbook's own name.

Seeds its own workbooks (tagged in `metadata`) and removes them afterwards, so it is
repeatable and leaves the seed data as it found it.

Assumes the local stack is already running (see README.md). Run with:

    cd apps/web/e2e && python3 smoke_workbook_search.py

Exits non-zero if any check fails or the page throws an unexpected runtime error.
Screenshots land in $E2E_OUT (default /tmp/e2e-workbook-search).
"""

from __future__ import annotations

import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

from helpers import BASE_URL, LOCALE, SEED_EMAIL, _psql, dismiss_cookie_banner, login

OUT = os.environ.get("E2E_OUT", "/tmp/e2e-workbook-search")
os.makedirs(OUT, exist_ok=True)

# Same expected-noise filter as the other specs: local Databricks creds are expired
# and Contentful preview can 404. Anything else is a real problem.
EXPECTED_NOISE = ("Databricks", "Contentful", "Failed to retrieve table metadata")

# Marker lives in `metadata`, which is NOT part of the generated `search_vector`, so
# it cannot pollute the very search results under test.
TAG = "wbsearch"

# The unfiltered list request carries no query string, so a glob needing "?" misses it.
LIST_URL = re.compile(r"/api/v1/workbooks(\?|$)")

results: list[tuple[bool, str]] = []
search_urls: list[str] = []


def check(ok: bool, label: str) -> None:
    results.append((bool(ok), label))
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")


# ── Fixtures ────────────────────────────────────────────────────

def _user_id(email: str) -> str:
    return _psql(f"SELECT id FROM users WHERE email = '{email}';")


def _org_id(user_id: str) -> str:
    """The user's personal org, which is what the app itself creates workbooks into."""
    return _psql(
        "SELECT o.id FROM organizations o "
        "JOIN organization_members m ON m.organization_id = o.id "
        f"WHERE m.user_id = '{user_id}' ORDER BY o.created_at LIMIT 1;"
    )


def remove_fixtures() -> None:
    _psql(f"DELETE FROM workbooks WHERE metadata->>'e2e' = '{TAG}';")


def seed_fixtures() -> dict[str, str]:
    """Insert the workbooks the checks need. Returns {'experiment_id', 'experiment_term'}."""
    remove_fixtures()  # idempotent re-run

    seed_user = _user_id(SEED_EMAIL)
    seed_org = _org_id(seed_user)
    # A second creator is what makes the creator-match check meaningful.
    other = _psql(
        "SELECT u.id || '|' || p.first_name || ' ' || p.last_name FROM users u "
        "JOIN profiles p ON p.user_id = u.id "
        f"WHERE u.email <> '{SEED_EMAIL}' AND p.activated = true AND p.deleted_at IS NULL "
        "ORDER BY u.email LIMIT 1;"
    )
    other_id, other_name = other.split("|")
    other_org = _org_id(other_id)

    rows = [
        ("Chlorophyll Fluorescence Baseline", "Baseline run", seed_user, seed_org),
        ("Leaf Area Index Survey", "Canopy survey", seed_user, seed_org),
        ("Drought Trial 2", "Second trial", seed_user, seed_org),
        ("Zephyr Notebook", "Unrelated name", other_id, other_org),
        ("Quokka Notebook", "To be linked", seed_user, seed_org),
    ]
    values = ",".join(
        f"('{n}', '{d}', '[]', '{{\"e2e\":\"{TAG}\"}}', '{u}', "
        f"{'NULL' if not o else chr(39) + o + chr(39)}, 'public')"
        for n, d, u, o in rows
    )
    _psql(
        "INSERT INTO workbooks (name, description, cells, metadata, created_by, "
        f"organization_id, visibility) VALUES {values};"
    )

    # An active experiment the seed user administers, with no workbook attached yet.
    exp = _psql(
        "SELECT e.id || '|' || e.name FROM experiments e "
        "JOIN experiment_members m ON m.experiment_id = e.id "
        "JOIN users u ON u.id = m.user_id "
        f"WHERE u.email = '{SEED_EMAIL}' AND m.role = 'admin' AND e.status = 'active' "
        "ORDER BY e.created_at LIMIT 1;"
    )
    exp_id, exp_name = exp.split("|")
    _psql(
        "UPDATE experiments SET workbook_id = NULL, workbook_version_id = NULL "
        f"WHERE id = '{exp_id}';"
    )
    # Longest alphabetic word in the name: distinctive enough to search for once linked.
    term = max(re.findall(r"[A-Za-z]{5,}", exp_name), key=len)
    print(f"  fixtures: 5 workbooks (creator '{other_name}'), experiment {exp_name!r}, term {term!r}")
    return {"experiment_id": exp_id, "experiment_term": term, "creator": other_name}


# ── Page helpers ────────────────────────────────────────────────

def options(page) -> list[str]:
    """Option labels in the open picker, in DOM (server) order."""
    page.wait_for_timeout(150)
    return [t.strip() for t in page.get_by_role("option").all_text_contents()]


def open_picker(page) -> None:
    """Click the closed trigger. cmdk's search input is also role=combobox once open."""
    trigger = page.get_by_role("combobox").first
    trigger.wait_for(state="visible", timeout=60_000)
    trigger.click()
    page.wait_for_timeout(400)


def type_search(page, term: str, settle: int = 1200) -> list[str]:
    box = page.get_by_placeholder(re.compile("Search workbook", re.I))
    box.click()
    box.fill("")
    box.press_sequentially(term, delay=30)
    page.wait_for_timeout(settle)  # 300ms debounce + request
    return options(page)


def design_url(experiment_id: str) -> str:
    return f"{BASE_URL}/{LOCALE}/platform/experiments/{experiment_id}/design"


# ── Checks ──────────────────────────────────────────────────────

def check_search(page, fx: dict[str, str]) -> None:
    print("\n[1] server-side search on the design page")
    page.goto(design_url(fx["experiment_id"]))
    page.wait_for_load_state("networkidle")
    dismiss_cookie_banner(page)
    open_picker(page)
    check(len(options(page)) >= 5, "picker lists the seeded workbooks")
    page.screenshot(path=f"{OUT}/01-picker-open.png")

    got = type_search(page, "chloro")
    check(got == ["Chlorophyll Fluorescence Baseline"], "'chloro' narrows via prefix/stemming")
    check(any("search=chloro" in u for u in search_urls), "the term reached the backend")
    page.screenshot(path=f"{OUT}/02-search.png")

    # Regression guard: this used to match every workbook via uuid characters.
    got = type_search(page, "2")
    check(got == ["Drought Trial 2"], "a single digit matches only the workbook named with it")

    got = type_search(page, "area")
    check(got == ["Leaf Area Index Survey"], "a mid-name term matches")

    # Decisive: the query appears nowhere in this workbook's own name, so any local
    # name filter would have thrown it away.
    got = type_search(page, fx["creator"].lower())
    check(got == ["Zephyr Notebook"], "creator-name match returned (proves no local name filter)")
    page.screenshot(path=f"{OUT}/03-creator-match.png")

    got = type_search(page, "notebook")
    check(
        len(got) == 2 and set(got) == {"Quokka Notebook", "Zephyr Notebook"},
        "a multi-match returns both, in server rank order",
    )

    got = type_search(page, "zzzznomatch")
    check(
        got == [] and page.get_by_text("No workbooks found").is_visible(),
        "empty state shows when the server returns nothing",
    )


def check_in_flight_states(page, fx: dict[str, str]) -> None:
    print("\n[2] in-flight states")
    # Previous results are held while the next query loads; they must be visibly stale
    # rather than blanked. Needs a non-empty starting list to have anything to hold.
    check(len(type_search(page, "notebook")) == 2, "non-empty list before the stale check")

    def delayed(route):
        time.sleep(6.0)  # plain sleep: pumping the loop here re-enters the handler
        route.continue_()

    page.route(LIST_URL, delayed)
    box = page.get_by_placeholder(re.compile("Search workbook", re.I))
    box.click()
    box.press_sequentially("!", delay=10)
    page.wait_for_timeout(700)  # past the debounce, inside the held response
    cls = page.locator("[cmdk-group]").first.get_attribute("class") or ""
    check("opacity-60" in cls, "held-over rows are dimmed while the new query is in flight")
    check(len(options(page)) > 0, "previous results stay on screen (no blank flicker)")
    page.screenshot(path=f"{OUT}/04-stale-dimmed.png")
    page.unroute(LIST_URL, delayed)
    page.wait_for_timeout(2500)

    # With nothing to hold over, the searching row shows instead of the empty state.
    # CDP latency, not a route handler: a sync-API handler that sleeps cannot run while
    # the main thread is blocked in page.goto, so it never delays the initial request
    # and this check would pass without ever exercising the state.
    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    slow = {"offline": False, "latency": 3000, "downloadThroughput": -1, "uploadThroughput": -1}
    cdp.send("Network.emulateNetworkConditions", slow)
    page.goto(design_url(fx["experiment_id"]), wait_until="domcontentloaded")
    open_picker(page)
    row = page.get_by_text("Searching workbooks")
    shown = bool(row.count() and row.first.is_visible())
    check(
        shown and page.get_by_role("option").count() == 0,
        "searching row shows when there is nothing to hold over",
    )
    page.screenshot(path=f"{OUT}/05-searching.png")
    cdp.send("Network.emulateNetworkConditions", {**slow, "latency": 0})


def check_attach_and_linked_match(page, fx: dict[str, str]) -> None:
    print("\n[3] attach, then linked-experiment matching")
    page.goto(design_url(fx["experiment_id"]))
    page.wait_for_load_state("networkidle")
    open_picker(page)
    check(type_search(page, "quokka") == ["Quokka Notebook"], "target workbook found for attach")
    page.get_by_role("option").first.click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name=re.compile("Attach", re.I)).first.click()
    page.wait_for_timeout(2500)
    check(page.get_by_text("Quokka Notebook").first.is_visible(), "workbook attached")
    page.screenshot(path=f"{OUT}/06-attached.png")

    # Linked to the experiment now, so the server should match it on the experiment's
    # name even though the workbook's own name has nothing to do with the term.
    change = page.get_by_role("button", name=re.compile("Change", re.I))
    if not change.count():
        check(False, "found the change-workbook control")
        return
    change.first.click()
    page.wait_for_timeout(600)
    open_picker(page)
    got = type_search(page, fx["experiment_term"].lower())
    check("Quokka Notebook" in got, "linked-experiment name match returned the workbook")
    page.screenshot(path=f"{OUT}/07-linked-experiment-match.png")


def check_new_experiment_form(page) -> None:
    print("\n[4] new-experiment form picker")
    page.goto(f"{BASE_URL}/{LOCALE}/platform/experiments/new")
    page.wait_for_load_state("networkidle")
    dismiss_cookie_banner(page)
    if not page.get_by_role("combobox").count():
        check(False, "new-experiment form exposes the workbook picker")
        return
    open_picker(page)
    check(any(o == "None" for o in options(page)), "none-option present")
    got = type_search(page, "chloro")
    check("Chlorophyll Fluorescence Baseline" in got, "search works in the form picker")
    page.screenshot(path=f"{OUT}/08-new-experiment.png")


def main() -> int:
    fx = seed_fixtures()
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on(
                "request",
                lambda r: search_urls.append(r.url)
                if "/api/v1/workbooks" in r.url and "search=" in r.url
                else None,
            )
            try:
                login(page)
                check_search(page, fx)
                check_in_flight_states(page, fx)
                check_attach_and_linked_match(page, fx)
                check_new_experiment_form(page)
            finally:
                page.screenshot(path=f"{OUT}/zz-final.png")
                browser.close()
    finally:
        _psql(
            "UPDATE experiments SET workbook_id = NULL, workbook_version_id = NULL "
            f"WHERE id = '{fx['experiment_id']}';"
        )
        remove_fixtures()
        print("\nfixtures removed, experiment link reset")

    real = [e for e in errors if not any(n in e for n in EXPECTED_NOISE)]
    failed = [label for ok, label in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed  (screenshots: {OUT})")
    for label in failed:
        print(f"  FAILED: {label}")
    for e in real[:5]:
        print(f"  PAGE ERROR: {e}")
    return 1 if failed or real else 0


if __name__ == "__main__":
    sys.exit(main())
