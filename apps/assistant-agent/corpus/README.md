# openJII assistant starter literature corpus

21 openly licensed works (CC BY 4.0) on photosynthesis measurement, chlorophyll fluorescence,
gas exchange, field phenotyping and photosynthesis modelling, plus the JII-funded 2026
photosynthesis-hackathon preprint (version 1). This directory is the portable, committable
record of the corpus: what the works are, where the originals lawfully live, and how to
rebuild the reading copies and import them into a local assistant-knowledge store.

It contains no binaries, no credentials and no local import state (organization ids, work
ids or admission statuses). Those live only in the operator's local checkout.

## Layout

- `manifest.json` — one entry per work: source id, source (`europepmc` or `biorxiv`), DOI,
  exact version (`version-of-record` or `v1-preprint`), licence + licence URL, source URL,
  JATS download URL, attribution string, the modifications notice carried by the reading
  copies, topic tags, coverage role and SHA-256 hashes of the four generated files.
- `build.py` — downloads each work's JATS from the recorded primary source, verifies the
  article-level CC BY 4.0 link in the archived permissions element, and regenerates the
  reading copies under `papers/<id>/`.
- `papers/<id>/` (gitignored output) — per work:
  - `source.xml` — the immutable original JATS, byte-for-byte as downloaded.
  - `rights-evidence.xml` — the article-level permissions element extracted from that JATS.
  - `reading-copy.txt` / `reading-copy.pdf` — derived text-only reading copies. These are
    transformations, not originals: generated pagination, and no figures, tables,
    supplementary files or bibliography.

The immutable/derived separation matters: only `source.xml` is the work as published;
`reading-copy.*` are openJII-generated derivatives and must always be presented with their
modifications notice.

## Rebuild

```bash
python3 -m pip install --user reportlab
python3 build.py            # all works; --only PMC5099005 to rebuild one
```

`build.py` fails a work whose archived permissions do not link CC BY 4.0, and rewrites the
file hashes in `manifest.json`. Reading-copy PDF hashes can vary across reportlab versions;
the `source.xml` hash is the stable identity of the original.

## Import into a local assistant-knowledge store

Import is a deliberate operator action against a running local backend — never something
this directory performs itself. For each built work, in order:

1. `POST /api/v1/assistant-knowledge/corpus` with title, authors, year, DOI, source URL,
   topic tags, the target organization id, and a rights record
   (`basis: "open-access"`, licence id/URL, attribution string).
2. `POST /api/v1/assistant-knowledge/corpus/{workId}/file` with `reading-copy.pdf`.
3. `POST /api/v1/assistant-knowledge/corpus/{workId}/parse` (Document Intelligence must be
   configured for the local environment).
4. Human review through `POST .../review`: accept the parse and approve rights **only after
   checking the archived `rights-evidence.xml` and the reading copy** — the build script's
   licence check is evidence, not approval.
5. `POST .../admit` to activate. Leave external-public status pending unless redistribution
   is separately approved.

A reference implementation of this loop lives in the operator's local
`.claude/starter-corpus/` scripts (`import-local.py`, `admit-local.py`), which are not
portable and are not part of this directory.

## Rights notes

- Every included work carries an explicit article-level CC BY 4.0 statement in its archived
  JATS permissions; attribution strings are recorded per work in `manifest.json`.
- bioRxiv v1 preprints are preprints: cite them as such (status and version).
- Works with NC/ND clauses, unclear licensing, or publisher-only access are excluded, not
  imported on hope. Candidate holds are tracked in the project artifacts, not here.
