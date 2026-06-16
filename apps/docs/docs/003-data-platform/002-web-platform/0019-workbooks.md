# Workbooks

A **workbook** is the data-collection design for an experiment: an ordered list of cells —
protocols, macros, questions, branches and markdown notes — that together define the measurement
flow the mobile app and pipeline follow.

Workbooks are versioned. When a workbook is attached to an experiment, the experiment pins an
**immutable published version**: editing the workbook afterwards never silently changes what a
running experiment collects until you explicitly publish and upgrade.

## Demo

The walkthrough below shows the full workbook flow: creating a workbook, adding protocol and macro
cells with a searchable picker, building a multiple-choice question with bulk options, attaching the
workbook to an experiment, and editing it in place from the experiment's **Design** tab.

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/workbook-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

## Building a workbook

Create a workbook from the **Workbooks** list. Creating it takes you straight to the editor — no
extra confirmation step — where changes autosave as you work.

Add cells from the empty-workbook tray or the inline **+** between cells:

- **Protocol / Macro** — opens a picker. The search box and (for macros) the language filter narrow
  the list as you type, so you can find an existing protocol or macro quickly, or create a new one
  inline.
- **Question** — captures field input. Multiple-choice questions support a fast **Edit as list**
  dialog: paste a whole spreadsheet column (one option per line) to add many options at once. Large
  option sets (for example thousands of plot IDs) collapse to a compact summary instead of rendering
  one input per option.
- **Branch / Markdown** — conditional paths and free-text notes.

## Attaching to an experiment

From an experiment's **Design** tab, attach a workbook (or create one). Attaching publishes the
workbook's current cells as a new version and pins the experiment to it.

The Design tab renders the **pinned version's snapshot** read-only, so you always see exactly what
the experiment is collecting — independent of any later edits to the underlying protocols, macros
or the workbook draft.

## Editing in place

The owner of the attached workbook can switch the Design tab between **View pinned version** (the
read-only snapshot) and **Edit workbook** (the live, autosaving draft) without leaving the
experiment. When the draft has changes the experiment hasn't adopted yet, an _update available_
banner lets an experiment admin publish a new version and upgrade the experiment to it.
