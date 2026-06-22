"""Record a walkthrough of the workbook UX improvements (Olivia's 2026-06-22 feedback).

Demos, in order:
  1. Workbook editor — the cell sidebar now shows each cell's *name* with a
     per-type icon/color (not a repeated "Question"), and the question editor
     has a prominent "Question text *" field. Multiple-choice answers explain
     the 64-character limit.
  2. New-experiment flow — the workbook picker is now a searchable combobox.
  3. Experiment design — the linked workbook can be renamed in place (owner only).

Prereqs: the local stack is up (see README.md) and the demo data is seeded
(rich [Seed] Demo Workbook with question/branch cells, a few extra workbooks,
and the workbook attached to the Soil Health experiment). Run:

    cd apps/web/e2e && python3 record_workbook_ux.py

Env:
    E2E_OUT   default /tmp/e2e-workbook-ux   (gets workbook-ux.webm + step PNGs)
"""

from __future__ import annotations

import os
import pathlib

from playwright.sync_api import sync_playwright

import helpers

BASE = helpers.BASE_URL
LOCALE = helpers.LOCALE
OUT = pathlib.Path(os.environ.get("E2E_OUT", "/tmp/e2e-workbook-ux"))
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORT = {"width": 1280, "height": 800}

# Seeded demo entities (see record_workbook_ux seed in the session / README).
DEMO_WORKBOOK_ID = os.environ.get("E2E_DEMO_WORKBOOK_ID", "6e4a7b69-a125-444b-b2d8-236845f2b7b0")
DEMO_EXPERIMENT_ID = os.environ.get("E2E_DEMO_EXPERIMENT_ID", "06c68043-c4da-41e6-889e-75e3bad6b6fb")


def beat(page, ms: int = 1400) -> None:
    """A deliberate pause so the recording is watchable."""
    page.wait_for_timeout(ms)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=str(OUT),
            record_video_size=VIEWPORT,
        )
        page = context.new_page()

        # --- Sign in (email-OTP, OTP read from Postgres) ---
        helpers.login(page)
        beat(page, 800)

        # --- 1. Workbook editor: sidebar names + icons, prominent question field ---
        page.goto(f"{BASE}/{LOCALE}/platform/workbooks/{DEMO_WORKBOOK_ID}", wait_until="networkidle")
        page.wait_for_selector("text=plot_health")
        beat(page, 1800)
        page.screenshot(path=str(OUT / "01-workbook-sidebar.png"))

        # Navigate via the sidebar — clicking a row scrolls to its cell.
        page.get_by_role("button", name="leaf_count").first.click()
        beat(page)
        page.get_by_role("button", name="plot_health").first.click()
        beat(page)

        # Surface the multiple-choice options + the new character-limit hint.
        hint = page.get_by_text("readable as buttons", exact=False).first
        hint.scroll_into_view_if_needed()
        beat(page, 1800)
        page.screenshot(path=str(OUT / "02-question-and-char-limit.png"))

        # --- 2. New experiment: searchable workbook picker ---
        page.goto(f"{BASE}/{LOCALE}/platform/experiments/new", wait_until="networkidle")
        beat(page, 1000)
        name = page.get_by_role("textbox").first
        name.click()
        name.press_sequentially("Spring Trial 2026", delay=35)
        beat(page)

        picker = page.get_by_role("combobox")
        picker.scroll_into_view_if_needed()
        picker.click()
        beat(page)
        page.screenshot(path=str(OUT / "03-picker-open.png"))

        search = page.get_by_placeholder("Search workbooks...")
        search.fill("wheat")
        beat(page, 1600)
        page.screenshot(path=str(OUT / "04-picker-filtered.png"))
        search.fill("")
        beat(page, 700)
        search.fill("corn")
        beat(page, 1200)
        page.get_by_role("option", name="Corn Canopy Photosynthesis").first.click()
        beat(page, 1600)
        page.screenshot(path=str(OUT / "05-picker-selected.png"))

        # --- 3. Experiment design: rename the linked workbook in place ---
        page.goto(
            f"{BASE}/{LOCALE}/platform/experiments/{DEMO_EXPERIMENT_ID}/design",
            wait_until="networkidle",
        )
        page.wait_for_selector("text=[Seed] Demo Workbook")
        beat(page, 1500)
        page.get_by_role("button", name="Rename workbook").first.click()
        beat(page)
        rename = page.get_by_role("textbox", name="Rename workbook")
        rename.click()
        for _ in range(40):
            rename.press("Backspace")
        rename.press_sequentially("Plot Survey Protocol", delay=45)
        beat(page)
        page.get_by_role("button", name="Save name").first.click()
        beat(page, 2000)
        page.screenshot(path=str(OUT / "06-renamed.png"))

        video = page.video.path() if page.video else None
        context.close()  # finalizes the video file
        browser.close()

        if video:
            stable = OUT / "workbook-ux.webm"
            os.replace(video, stable)
            print(f"video -> {stable}")
        print(f"screenshots -> {OUT}")


if __name__ == "__main__":
    main()
