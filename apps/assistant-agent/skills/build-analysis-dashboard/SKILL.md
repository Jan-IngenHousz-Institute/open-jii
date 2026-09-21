---
name: build-analysis-dashboard
description: Turn an accessible experiment dataset into saved visualizations and a dashboard plan, checking data readiness and chart configuration.
metadata:
  status: candidate
  version: "0.1.1"
---

1. Establish the experiment, question, dataset, and comparison the researcher wants. Read the permitted dataset metadata and a bounded sample. Use returned machine column keys for filters and saved configuration; display labels are not necessarily unique query keys.
2. Verify the data is queryable before building charts. An upload acknowledgement does not establish materialization in the serving table. If the dataset is still processing, report that state and stop chart creation until a later permitted read establishes readiness. Do not trigger data-platform jobs through an unrelated tool.
3. Choose chart roles from the actual column types and units. Specify aggregation, grouping, missing-value handling, and any filters. Check the current visualization contract for categorical color/split behavior. A historical line chart was blank until its categorical color mode was configured; treat this as a diagnostic clue, not a universal chart setting.
   For an existing Databricks dashboard, establish both its hosting workspace and its source catalogs. A sandbox dashboard can read production data. Inspect saved queries and available pipeline provenance instead of inferring lineage or fleet size from titles. Distinguish event time, ingestion time and monitoring build time. Check whether points are raw or aggregated and how gaps are represented. Operational freshness must be checked against the wall clock; a window anchored only to the newest data can hide stopped ingestion. If those read tools are unavailable, request the relevant configuration or report the limitation rather than guessing.
4. Prepare each saved visualization through `draft_entity` with kind `visualization`, the destination experiment, and its data configuration. Confirmation is required before creation.
5. Re-read the confirmed resources and inspect rendered plots when a supported preview is available. Check populated traces, labels, units, filters, and totals against the source. If preview is unavailable, distinguish saved configuration from verified rendering.
6. Arrange the confirmed charts into a dashboard plan suited to the question. The current assistant has no dashboard-write draft kind. Explain the manual dashboard step until a permission-checked dashboard tool exists; API documentation alone does not authorize an arbitrary HTTP write.

Consult `apps/docs/content/guide/data-analysis/viewing-data.mdx`, `packages/api/src/domains/experiment/visualizations/`, and `packages/api/src/domains/experiment/dashboards/`. The historical four-chart, 2-by-2 promo layout is an example, not a required dashboard size. Synthetic survey data must remain labelled synthetic.
