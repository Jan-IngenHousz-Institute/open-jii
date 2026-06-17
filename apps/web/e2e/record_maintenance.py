"""Record the maintenance-page fallback that renders when Contentful is unreachable.

Run the web app (prod build) WITHOUT Contentful creds, then:
    python3 e2e/record_maintenance.py

Env:
    BASE_URL  default http://localhost:3000
    OUT_DIR   default /tmp/maint-rec   (gets a .webm video + per-page PNGs)
"""

import os
import pathlib

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
OUT = pathlib.Path(os.environ.get("OUT_DIR", "/tmp/maint-rec"))
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORT = {"width": 1280, "height": 800}

PAGES = [
    ("/en-US", "home"),
    ("/en-US/about", "about"),
    ("/en-US/faq", "faq"),
    ("/en-US/blog", "blog"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        viewport=VIEWPORT,
        record_video_dir=str(OUT),
        record_video_size=VIEWPORT,
    )
    page = context.new_page()

    for path, name in PAGES:
        resp = page.goto(f"{BASE}{path}", wait_until="networkidle")
        # The maintenance heading is rendered by the error boundary client-side.
        page.wait_for_selector("text=/back soon/i", timeout=15000)
        page.wait_for_timeout(2000)
        page.screenshot(path=str(OUT / f"{name}.png"))
        print(f"{path} -> HTTP {resp.status if resp else '?'} (maintenance shown)")

    video_path = page.video.path() if page.video else None
    context.close()  # finalize video
    browser.close()

    if video_path:
        stable = OUT / "maintenance.webm"
        os.replace(video_path, stable)
        print(f"video -> {stable}")
