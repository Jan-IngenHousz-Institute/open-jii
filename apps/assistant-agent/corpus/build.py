#!/usr/bin/env python3
"""Lawful rebuild of the openJII assistant starter corpus reading copies.

For each entry in manifest.json this script downloads the article's JATS XML from
the recorded primary source (Europe PMC or bioRxiv), verifies that the archived
article-level permissions element links CC BY 4.0, and regenerates the attributed
text-only reading copy (TXT + PDF) beside the immutable source files.

This script performs licence *verification* only. It does not approve rights:
corpus admission, external redistribution and any non-CC-BY work remain human
review decisions made through the assistant-knowledge review endpoints.

Requires: python >= 3.11, reportlab, and a DejaVu Sans TTF at
/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf (override with DEJAVU_TTF).
Usage: python3 build.py [--only ID ...]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as E
from pathlib import Path
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
CC_BY_40 = re.compile(r"https?://creativecommons\.org/licenses/by/4\.0/?")
SKIP_TAGS = {"fig", "table-wrap", "supplementary-material", "ref-list"}
DEJAVU = os.environ.get("DEJAVU_TTF", "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf")
USER_AGENT = "openjii-corpus-build/1.0 (lawful OA text retrieval)"


def text_of(node) -> str:
    return " ".join("".join(node.itertext()).split()) if node is not None else ""


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=90) as response:
        return response.read()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_article(raw: bytes) -> tuple[E.Element, str, str]:
    root = E.fromstring(raw)
    meta = root.find(".//article-meta")
    if meta is None:
        raise ValueError("no article-meta in JATS")
    permissions = meta.find("permissions")
    evidence = E.tostring(permissions, encoding="unicode") if permissions is not None else ""
    if not CC_BY_40.search(evidence):
        raise ValueError("article-level CC BY 4.0 link not present in JATS permissions")
    return root, meta, evidence


def reading_copy_sections(root: E.Element, meta: E.Element) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    for abstract in meta.findall("abstract"):
        sections.extend([("Heading2", "Abstract"), ("BodyText", text_of(abstract))])

    def walk(node: E.Element) -> None:
        if node.tag in SKIP_TAGS:
            return
        if node.tag in {"title", "p"}:
            sections.append(("Heading2" if node.tag == "title" else "BodyText", text_of(node)))
            return
        for child in node:
            walk(child)

    body = root.find("body")
    if body is not None:
        walk(body)
    return sections


def render_pdf(path: Path, sections: list[tuple[str, str]]) -> None:
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    pdfmetrics.registerFont(TTFont("DejaVu", DEJAVU))
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = "DejaVu"

    def footer(canvas, doc):
        canvas.setFont("DejaVu", 8)
        canvas.drawString(
            42, 24, f"Text reading copy | generated page {doc.page} | not publisher pagination"
        )

    story = []
    for style_name, content in sections:
        if content:
            story.extend([Paragraph(escape(content), styles[style_name]), Spacer(1, 7)])
    SimpleDocTemplate(
        str(path), leftMargin=42, rightMargin=42, topMargin=42, bottomMargin=42
    ).build(story, onFirstPage=footer, onLaterPages=footer)


def build_one(paper: dict) -> dict:
    paper_id = paper["id"]
    out_dir = ROOT / "papers" / paper_id
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = fetch(paper["downloadUrl"])
    root, meta, evidence = parse_article(raw)

    title = text_of(meta.find("title-group/article-title"))
    if not title:
        raise ValueError(f"{paper_id}: no article title")

    sections = [("Title", paper["title"])]
    sections.append(("BodyText", paper["attribution"]))
    sections.append(("BodyText", paper["modifications"]))
    sections.extend(reading_copy_sections(root, meta))

    (out_dir / "source.xml").write_bytes(raw)
    (out_dir / "rights-evidence.xml").write_text(evidence)
    (out_dir / "reading-copy.txt").write_text("\n\n".join(t for _, t in sections))
    render_pdf(out_dir / "reading-copy.pdf", sections)

    hashes = {
        name: sha256(out_dir / name)
        for name in ("source.xml", "rights-evidence.xml", "reading-copy.txt", "reading-copy.pdf")
    }
    print(f"{paper_id}: ok ({paper['title'][:60]})", flush=True)
    return {"files": {name: {"sha256": digest} for name, digest in hashes.items()}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", default=None, help="build only these paper ids")
    args = parser.parse_args()

    manifest = json.loads((ROOT / "manifest.json").read_text())
    papers = manifest["papers"]
    if args.only:
        wanted = set(args.only)
        papers = [p for p in papers if p["id"] in wanted]
        missing = wanted - {p["id"] for p in papers}
        if missing:
            print(f"unknown ids: {sorted(missing)}", file=sys.stderr)
            return 2

    failures = []
    for paper in papers:
        try:
            paper.update(build_one(paper))
        except Exception as error:  # noqa: BLE001 - report and continue with the next work
            failures.append((paper["id"], str(error)))
            print(f"{paper['id']}: FAILED {error}", file=sys.stderr, flush=True)
        time.sleep(1)  # polite pacing for the public APIs

    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    if failures:
        print(f"{len(failures)} failures: {failures}", file=sys.stderr)
        return 1
    print(f"built {len(papers)} reading copies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
