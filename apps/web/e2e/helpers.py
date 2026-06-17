"""
Reusable Playwright helpers for openJII web E2E.

The platform is gated behind email-OTP auth (better-auth). There is no password.
For local/CI runs we read the OTP straight out of Postgres — better-auth stores it
in plaintext in the `verifications` table — instead of scraping a mailbox.

See README.md in this folder for the full stack/seed/login story.
"""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

# Defaults match the documented local stack (see README.md). Override via env.
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
LOCALE = os.environ.get("E2E_LOCALE", "en-US")
SEED_EMAIL = os.environ.get("E2E_EMAIL", "seed@openjii.local")
PG_CONTAINER = os.environ.get("E2E_PG_CONTAINER", "database-postgres-1")
PG_DB = os.environ.get("E2E_PG_DB", "openjii_local")
PG_USER = os.environ.get("E2E_PG_USER", "postgres")
# Directory where per-flow screenshots and .webm videos are written (docs assets).
VIDEO_DIR = os.environ.get("E2E_VIDEO_DIR", os.path.join(os.path.dirname(__file__), "artifacts"))
VIEWPORT = {"width": 1440, "height": 900}


def start_recording(playwright, name: str):
    """Launch headless chromium and a video-recording context for one flow.

    Returns (browser, context, page). Pair with `finish_recording` to flush and
    rename the webm to <name>.webm under VIDEO_DIR.
    """
    out = Path(VIDEO_DIR) / "videos"
    out.mkdir(parents=True, exist_ok=True)
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport=VIEWPORT,
        record_video_dir=str(out),
        record_video_size=VIEWPORT,
    )
    page = context.new_page()
    return browser, context, page


def finish_recording(page, context, browser, name: str) -> str | None:
    """Close the context (flushing the video) and rename it to <name>.webm."""
    video = page.video
    context.close()
    browser.close()
    if video is None:
        return None
    src = Path(video.path())
    dst = src.with_name(f"{name}.webm")
    try:
        if dst.exists():
            dst.unlink()
        src.rename(dst)
    except OSError:
        dst = src
    return str(dst)


def _psql(sql: str) -> str:
    """Run a one-shot query against the local Postgres container and return stdout."""
    out = subprocess.check_output(
        ["podman", "exec", PG_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-tAc", sql],
        text=True,
    )
    return out.strip()


def _latest_otp_created_at(email: str) -> str:
    """Timestamp of the newest sign-in OTP for `email` (empty string if none)."""
    return _psql(
        "SELECT coalesce(max(created_at)::text, '') FROM verifications "
        f"WHERE identifier = 'sign-in-otp-{email}';"
    )


def wait_for_fresh_otp(email: str, since: str, timeout: float = 20.0) -> str:
    """Poll Postgres for an OTP created after `since` and return its 6-digit code.

    better-auth stores the row as identifier='sign-in-otp-<email>', value='<otp>:<attempts>'.
    """
    deadline = time.time() + timeout
    cond = f"created_at > '{since}'" if since else "true"
    while time.time() < deadline:
        row = _psql(
            "SELECT split_part(value, ':', 1) FROM verifications "
            f"WHERE identifier = 'sign-in-otp-{email}' AND {cond} "
            "ORDER BY created_at DESC LIMIT 1;"
        )
        if row:
            return row
        time.sleep(0.5)
    raise TimeoutError(f"No fresh OTP for {email} appeared within {timeout}s")


def seed_experiment_id(email: str = SEED_EMAIL) -> str:
    """Return an experiment id the seed user owns (for detail/data-page checks)."""
    return _psql(
        "SELECT e.id FROM experiments e "
        "JOIN experiment_members m ON m.experiment_id = e.id "
        "JOIN users u ON u.id = m.user_id "
        f"WHERE u.email = '{email}' AND e.status = 'active' "
        "ORDER BY e.created_at LIMIT 1;"
    )


def dismiss_cookie_banner(page) -> None:
    """Click 'Reject all' on the consent banner if it is showing (privacy-preserving)."""
    btn = page.get_by_role("button", name="Reject all")
    if btn.count() and btn.first.is_visible():
        btn.first.click()


def login(page, base_url: str = BASE_URL, email: str = SEED_EMAIL) -> None:
    """Drive the real email-OTP login UI: type the email, read the OTP, type it in.

    Leaves the page on the authenticated dashboard (/<locale>/platform).
    """
    page.goto(f"{base_url}/{LOCALE}/login")
    page.wait_for_load_state("networkidle")
    dismiss_cookie_banner(page)

    # Type the email as a real user would (per-character keystrokes).
    email_input = page.get_by_placeholder("Enter your email...")
    email_input.click()
    email_input.press_sequentially(email, delay=20)

    # Record the current newest OTP so we can wait for a strictly newer one.
    since = _latest_otp_created_at(email)
    page.get_by_role("button", name="Continue with Email").click()

    # Backend issues the OTP; read it from Postgres and type it into the code field.
    otp = wait_for_fresh_otp(email, since)
    code_input = page.locator('input[autocomplete="one-time-code"]')
    code_input.wait_for(state="visible", timeout=10_000)
    code_input.click()
    code_input.press_sequentially(otp, delay=40)  # input-otp auto-submits on the 6th digit

    page.wait_for_url(f"**/{LOCALE}/platform", timeout=15_000)
    page.wait_for_load_state("networkidle")
