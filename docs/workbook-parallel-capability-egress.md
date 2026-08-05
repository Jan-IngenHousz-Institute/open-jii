# Parallel workbook capability egress audit

Audit command (contract outputs are the source of truth):

```sh
rg -n '\.output\((zWorkbook|zWorkbookList|zWorkbookVersion|zExperimentFlow)' \
  packages/api/src/domains
```

Every endpoint below can disclose a full `cells` array or flow `graph`. Each
checks content for a `parallel` root before returning it. Writes also check the
request before mutation. A missing `x-workbook-capabilities:
workbook-parallel-v1` header yields HTTP 426 with an empty response body.

| Egress                                            | Payload                 | Guard disposition                                |
| ------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `GET /api/v1/workbooks/{id}`                      | live draft cells        | Check returned draft                             |
| `POST /api/v1/workbooks`                          | created workbook cells  | Check request cells and returned workbook        |
| `PATCH /api/v1/workbooks/{id}`                    | updated workbook cells  | Check request cells and returned workbook        |
| `GET /api/v1/workbooks/{id}/versions/{versionId}` | immutable version cells | Check returned version                           |
| `GET /api/v1/experiments/{id}/flow`               | stored flow graph       | Check returned graph                             |
| `POST /api/v1/experiments/{id}/flow`              | created flow graph      | Check request before mutation and returned graph |
| `PUT /api/v1/experiments/{id}/flow`               | updated flow graph      | Check request before mutation and returned graph |

`GET /api/v1/workbooks` and `GET /api/v1/workbooks/{id}/versions` are
intentionally absent: current-main list items and version summaries omit cells.
Experiment/workbook association endpoints return ids and version numbers only.
No other API contract output references a full workbook or experiment-flow
schema.

## Client chain

- Web declares `workbook-parallel-v1` on its shared oRPC link and applies the
  same content guard as a query selector, including cached responses.
- Mobile declares no capability. Its query selector rejects cached versions,
  its loader checks the projected graph before hydration, and its persistence
  rehydration guard discards any container flow and answer history.
- Parallel publishing is independently protected by the default-off
  `workbook-parallel-publish` feature flag.
