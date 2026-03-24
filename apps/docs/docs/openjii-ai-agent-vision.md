# openJII AI Agent: Vision & Technical Design

## Overview

The openJII AI Agent is an AI-powered research assistant embedded into the openJII platform. Its purpose is to lower the barrier to entry for plant science researchers who need to design experiments, collect data, run analyses, and interpret results -- but who may not have deep expertise in statistics, programming, or the specifics of our sensor hardware.

The agent is not a standalone chatbot. It is a context-aware assistant that understands the user's current experiment, their data, the protocols and macros available on the platform, and the stage of their research workflow. It meets researchers where they are: in the experiment creation form, in the data explorer, in the mobile app during field collection.

This document covers eight capabilities, what each one requires to build, and how it integrates into the existing openJII architecture.

---

## 1. Experiment Design Assistant

### What it does

Helps researchers design field experiments before they collect a single measurement. The agent asks about the research question, available resources (number of plots, field dimensions, number of genotypes/treatments), and then recommends:

- **Experimental design type**: Completely Randomized Design (CRD), Randomized Complete Block Design (RCBD), split-plot, augmented design, alpha-lattice, etc.
- **Grid/layout generation**: Produces a plot layout with row/column assignments, blocking structure, and randomization. This could output directly into the experiment's location or layout configuration.
- **Replication calculations**: Given an expected effect size, variance estimate, and desired power (default 0.80), calculates the minimum number of replications needed.
- **Plot size recommendations**: Based on crop type and trait being measured, suggests minimum plot sizes for reliable phenotyping.

### Example interaction

> **Researcher**: "I want to compare 4 nitrogen treatments across 3 field blocks. I have 48 plots available."
>
> **Agent**: "With 4 treatments and 3 blocks, an RCBD gives you 12 plots per block -- 3 reps per treatment per block, 9 reps total per treatment. That leaves 12 plots unused. I'd recommend adding a 4th block for 16 plots each (4 reps/treatment/block), giving you 16 total reps per treatment. That provides >0.95 power for detecting a 15% treatment effect at typical field variance. Here's the randomized layout..."

### What it takes to build

- **LLM integration**: An LLM (Claude, GPT-4, or similar) with a system prompt containing experimental design domain knowledge and access to the platform's experiment creation API.
- **Tool/function calling**: The agent needs tool access to:
  - Query the experiment's current configuration (via the existing `experiments` API contract)
  - Generate randomization layouts (a utility function, potentially a Python service or an R-based randomization engine)
  - Write layouts back via the experiment locations/grid API
- **Power analysis engine**: Either a built-in statistical calculator (Python `statsmodels` or R `pwr` package exposed as a microservice) or an LLM that can reliably compute power from first principles.
- **UI surface**: A chat panel or guided wizard within the experiment creation flow on the web platform (`/platform/experiments/new`).

### How it fits

The experiment creation flow already supports locations (`experimentLocations` table with lat/lng), members, and protocol associations. The agent would sit alongside the existing creation form and propose configurations that the user can accept, modify, or reject. Layout data could be stored as structured JSON in the experiment's metadata or as a new `experimentLayouts` table.

---

## 2. Protocol Finder

### What it does

Researchers often know *what* they want to measure (e.g., "chlorophyll content", "electron transport rate", "leaf thickness") but not *which protocol* to select from the library. The Protocol Finder:

- Accepts natural language descriptions of what the researcher wants to measure
- Searches the protocol library (the `protocols` table: name, description, code JSON, sensor family)
- Ranks results by relevance and explains what each protocol actually measures, what sensor it requires (MultispeQ vs. Ambyte), and what output parameters it produces
- Flags incompatibilities (e.g., "That protocol requires a MultispeQ v2, but your experiment is set up for Ambyte sensors")

### Example interaction

> **Researcher**: "I want to measure how efficiently my plants use light for photosynthesis"
>
> **Agent**: "You're looking for photosynthetic efficiency parameters. Here are the most relevant protocols:
> 1. **Phi2 Protocol** (MultispeQ) -- Measures the quantum yield of Photosystem II (Phi2), which directly quantifies light-use efficiency. This is your best match.
> 2. **PAM Fluorescence** (MultispeQ) -- Measures Fv/Fm (maximum quantum yield) and other fluorescence parameters. Good for stress detection.
> 3. **SPAD + Phi2 Combined** (MultispeQ) -- Measures both chlorophyll content and Phi2 in one measurement.
>
> Want me to add one of these to your experiment?"

### What it takes to build

- **Semantic search over protocols**: Embed protocol names, descriptions, and code-derived parameter names into a vector store. When a researcher describes what they want, do a similarity search.
- **Protocol metadata enrichment**: The current `protocols` table stores `code` as a JSONB array (the sensor instruction set). We need to extract human-readable parameter names from the protocol code and store them as searchable metadata. This could be a one-time enrichment script or a derived field.
- **LLM layer**: The LLM interprets the researcher's intent, queries the vector store, and presents results with explanations. The LLM needs domain knowledge about plant physiology measurement parameters (Phi2, PhiNPQ, PhiNO, ECS, SPAD, etc.).
- **Protocol-experiment compatibility check**: Cross-reference the protocol's `family` field (multispeq, ambit, generic) with the sensors registered to the experiment.

### How it fits

Protocols are already associated with experiments via the `experimentProtocols` join table. The agent's recommendation flows directly into the existing "add protocol to experiment" action. On the web platform, this could live in the experiment's protocol configuration tab. On mobile, it could be part of experiment selection or a help overlay.

---

## 3. Macro Recommender

### What it does

Once a researcher has selected a protocol and collected data, they need to process it with the right macro (analysis script). The Macro Recommender:

- Suggests macros that are compatible with the selected protocol(s) -- using the existing `protocolMacros` compatibility table
- Explains what each macro computes (e.g., "This macro calculates Phi2, PhiNPQ, and PhiNO from raw fluorescence traces")
- Helps researchers write or customize macros if no existing one fits their needs
- Validates that a custom macro's output schema is compatible with the visualization and data pipeline

### Example interaction

> **Researcher**: "I just collected data with the Phi2 Protocol. What macros should I use?"
>
> **Agent**: "There are 2 macros compatible with the Phi2 Protocol:
> 1. **Phi2 Standard Analysis** (Python) -- Computes Phi2, PhiNPQ, PhiNO, and relative chlorophyll. This is the standard analysis most researchers use.
> 2. **Phi2 Extended** (Python) -- Everything in Standard, plus LEF (Linear Electron Flow) and NPQt. Requires ambient light data in the measurement.
>
> Based on your protocol configuration, both are compatible. I'd recommend starting with Standard Analysis."

### What it takes to build

- **Protocol-macro graph traversal**: Query the `protocolMacros` join table to get compatible macros for the experiment's protocols. This data already exists.
- **Macro description enrichment**: Current macro metadata (name, description, language, code) is stored in the `macros` table. The `code` field is base64-encoded source. The agent needs to either:
  - Parse macro source code to extract input/output parameter descriptions
  - Rely on enriched descriptions (preferred -- add structured metadata to macro records)
- **Code generation assistance**: For custom macros, the agent needs to understand the macro execution environment (Pyodide on mobile, Databricks on the data platform) and the expected input/output contract (receives JSON measurement data, returns JSON processed data).
- **Validation**: Before recommending a custom macro, verify it handles the expected input schema from the protocol.

### How it fits

The macro execution pipeline already exists in two places:
1. **Mobile**: Pyodide-based sandbox (`python-macro-sandbox.ts`) that runs Python macros in a WebView
2. **Data platform**: Databricks pipelines (`experiment_pipeline.py`) that execute macros at scale via the `multispeq` library

The agent would integrate at the experiment flow editor level (where measurement and analysis nodes are configured in the `flows` graph) and suggest analysis nodes to add after measurement nodes.

---

## 4. Visualization Template Picker

### What it does

After data is collected and processed, researchers need to visualize it. The platform already supports a rich set of chart types (line, scatter, bar, box-plot, histogram, violin-plot, heatmap, correlation-matrix, and 20+ others). The agent:

- Analyzes the experiment's data tables (column types, cardinality, temporal range)
- Recommends appropriate chart types based on the data and the research question
- Pre-configures the visualization with sensible defaults (axis assignments, color schemes, legends)
- Creates the visualization configuration that the user can then fine-tune

### Example interaction

> **Researcher**: "I have Phi2 data across 4 treatments collected over 6 weeks. How should I visualize this?"
>
> **Agent**: "Here are my recommendations:
> 1. **Time series line chart** -- Phi2 (y-axis) over time (x-axis), colored by treatment. Shows trends and treatment divergence over time.
> 2. **Box plot** -- Phi2 grouped by treatment. Good for comparing distributions at a specific time point or overall.
> 3. **Heatmap** -- Phi2 values by plot position in your field layout. Reveals spatial patterns or edge effects.
>
> Want me to create the time series chart? I'll use the `raw_data` table with Phi2 on the y-axis and timestamp on the x-axis, colored by your treatment question column."

### What it takes to build

- **Data introspection**: Query the experiment's Databricks tables via the existing `ExperimentDataRepository` to get column names, types, and sample data. The metadata cache table (`ExperimentTableMetadata`) already provides table identifiers and schemas.
- **Chart recommendation logic**: Rules-based + LLM hybrid:
  - Temporal data + continuous variable = line chart
  - Categorical grouping + continuous variable = box plot or violin plot
  - Two continuous variables = scatter plot
  - Spatial data (row/column) + continuous variable = heatmap
  - Many variables = correlation matrix or parallel coordinates
- **Config generation**: Output a valid `experimentVisualizations` record with `chartFamily`, `chartType`, `config`, and `dataConfig` fields matching the existing Zod schemas (`zChartDataConfig`, `zAxisConfig`, `zChartDisplayOptions`).
- **UI**: Integrated into the experiment's analysis/visualizations tab (`/platform/experiments/[id]/analysis/visualizations`).

### How it fits

The visualization system is already built: the `experimentVisualizations` table stores chart configurations, and renderers exist for line charts, scatter charts, and more (in `apps/web/components/experiment-visualizations/chart-renderers/`). The agent would generate the same config objects that the manual visualization creation wizard produces, just faster and with domain-informed defaults.

---

## 5. Statistical Analysis

### What it does

Goes beyond visualization to perform actual statistical tests on experiment data. Capabilities include:

- **ANOVA**: One-way and two-way analysis of variance for treatment comparisons. Automatic detection of blocking factors for appropriate model specification.
- **Treatment comparisons**: Post-hoc tests (Tukey HSD, LSD) with multiple comparison correction. Presents results as letter groupings that researchers are familiar with.
- **Heritability (H²)**: If genotype data is present (from question responses or metadata), calculates broad-sense heritability using variance component estimation. Critical for breeding programs.
- **SNP-trait associations**: If genetic marker data is available (imported or linked), performs marker-trait association analysis. This is an advanced feature for genomics-oriented users.
- **Descriptive statistics**: Mean, median, SD, CV, confidence intervals -- per treatment, per genotype, per time point.

### Example interaction

> **Researcher**: "Is there a significant difference in Phi2 between my treatments?"
>
> **Agent**: "I ran a one-way ANOVA on Phi2 grouped by treatment (n=48 per treatment, 4 treatments).
>
> | Source    | df | SS    | MS    | F     | p-value  |
> |-----------|----|-------|-------|-------|----------|
> | Treatment | 3  | 0.142 | 0.047 | 12.34 | <0.001   |
> | Residual  | 188| 0.723 | 0.004 |       |          |
>
> Tukey HSD groupings:
> - Treatment A: 0.72 (a)
> - Treatment B: 0.69 (a)
> - Treatment C: 0.61 (b)
> - Treatment D: 0.58 (b)
>
> Treatments A and B are not significantly different from each other, but both are significantly higher than C and D (p < 0.01)."

### What it takes to build

- **Statistical compute service**: A Python microservice (or Databricks notebook) with `scipy`, `statsmodels`, `pingouin`, or similar. This cannot run reliably in an LLM alone -- the agent should call a deterministic statistical engine and then interpret the results.
- **Data access**: The agent needs to pull data from experiment tables via the Databricks SQL adapter (already used by `ExperimentDataRepository`). It would construct SQL queries like `SELECT phi2, treatment FROM experiment_schema.processed_data`.
- **Result interpretation**: The LLM interprets the statistical output in plain language, flags assumptions that may be violated (normality, homoscedasticity), and suggests follow-up analyses.
- **Heritability pipeline**: Requires variance component estimation (REML). Needs genotype identifiers in the data -- these could come from question responses in the measurement flow (e.g., a multi-choice question node asking "Which genotype?").
- **Genetic marker integration**: Would require a new data import pathway for marker/SNP data. This is the most complex sub-feature and could be phased in later.

### How it fits

The data platform already processes measurement data through a medallion architecture (Bronze -> Silver -> Gold in Databricks). Statistical analysis results could be stored as a new "Gold" layer table or as part of the experiment's metadata. Results would display in the web platform's analysis tab alongside visualizations.

---

## 6. Natural Language Querying

### What it does

Lets researchers query their experiment data using plain English instead of SQL or navigating through data table UIs. The agent translates natural language into SQL queries against the experiment's Databricks tables, executes them, and presents the results.

### Example interactions

> "Show me the average Phi2 values for treatment A vs B over the last week"
>
> "Which plots had the lowest chlorophyll content on June 15?"
>
> "How many measurements did each team member contribute this month?"
>
> "Give me a summary of all data collected with the Phi2 Protocol"

### What it takes to build

- **Text-to-SQL engine**: The agent needs to know the schema of each experiment's tables. The `ExperimentTableMetadata` interface already provides column names and types. The agent constructs parameterized SQL queries against the experiment's Unity Catalog schema.
- **Schema context injection**: For each query, inject the current experiment's table schemas into the LLM prompt. The experiment pipeline creates tables like `raw_data`, `device`, `raw_ambyte_data`, and dynamic macro output tables.
- **Query sandboxing**: All generated SQL must be read-only (`SELECT` only) and scoped to the user's experiment schema. The Databricks SQL adapter already enforces schema-level isolation.
- **Result formatting**: Return results as tables, summaries, or charts depending on the query. If the result is a single number, present it inline. If it is a table, render it. If it lends itself to a chart, offer to create a visualization.
- **Guardrails**: Limit query complexity (no cross-joins on huge tables), add row limits, and handle errors gracefully ("That column doesn't exist in your data. Did you mean 'phi2' instead of 'Phi2'?").

### How it fits

The backend already has a `ExperimentDataRepository` that queries Databricks via a SQL adapter with pagination and column selection. The natural language query engine would use the same data path but construct queries dynamically based on the LLM's interpretation of the user's question. This surfaces as a search/chat bar in the experiment's data exploration tab (`/platform/experiments/[id]/data`).

---

## 7. Onboarding & Guidance

### What it does

Walks new users through the platform step by step. Plant researchers are the target audience, not software engineers. The agent provides contextual help throughout the platform:

- **First experiment walkthrough**: "Let's create your first experiment. What's your research question?" -> guides through naming, adding members, selecting protocols, configuring the measurement flow.
- **Sensor connection guide**: On mobile, detects when a user is trying to connect a MultispeQ for the first time and walks them through Bluetooth pairing, calibration, and a test measurement.
- **Flow editor help**: When building a measurement flow (the graph of instruction/question/measurement/analysis nodes), explains what each node type does and suggests a sensible flow structure.
- **Contextual tooltips**: When a user hovers over or clicks on unfamiliar terms (Phi2, PhiNPQ, RCBD), provides inline explanations.

### Example interaction

> **New user lands on the platform for the first time**
>
> **Agent**: "Welcome to openJII. I can help you get started. Are you:
> 1. Setting up a new experiment?
> 2. Joining an existing experiment?
> 3. Just exploring the platform?
>
> If you're setting up a new experiment, I'll walk you through creating one, adding your first protocol, and building a measurement flow."

### What it takes to build

- **Onboarding state machine**: Track where the user is in the onboarding process. Store progress in the user's profile or a separate `onboardingProgress` table.
- **Platform context awareness**: The agent needs to know which page the user is on, what actions they've taken, and what's missing. This means passing UI state (current route, experiment status, connected sensors) to the agent.
- **Mobile-specific integration**: On the mobile app (React Native/Expo), the agent needs access to Bluetooth connection state, calibration status, and measurement flow progress. This hooks into the existing `device-connection-manager` and `scan-manager` services.
- **Content library**: Pre-written explanations for all domain concepts (from the existing glossary at `apps/docs/docs/001-introduction/glossary-terminology.md`) enriched with more detail.
- **Non-intrusive UI**: The agent should be available but not forced. A persistent help icon or chat button that expands into a side panel.

### How it fits

The mobile app already has an experiment selection step, measurement flow container, and flow state management in `apps/mobile/src/screens/measurement-flow-screen/`. The web app has the experiment creation wizard. The agent wraps around these existing flows as a guide layer, not a replacement.

---

## 8. Report Generation

### What it does

Automatically generates experiment reports that summarize key findings, include visualizations, and present statistical results. Outputs could be:

- **PDF reports** for publication supplements or internal review
- **Markdown/HTML** for sharing on the platform
- **Structured data exports** (CSV + metadata JSON) for downstream tools

### Report contents

- Experiment metadata: name, dates, locations, team members, protocols used
- Data summary: number of measurements, time range, completeness metrics
- Key visualizations: auto-selected or user-pinned charts from the experiment
- Statistical results: ANOVA tables, treatment comparisons, heritability estimates
- Data quality notes: flagged outliers (from annotations), missing data patterns
- Methods section: auto-generated description of protocols and macros used, suitable for a paper's methods section

### Example interaction

> **Researcher**: "Generate a report for my nitrogen trial"
>
> **Agent**: "Here's a draft report for 'Nitrogen Trial 2026':
>
> **Summary**: 192 measurements collected across 4 treatments, 3 blocks, over 6 weeks (Feb 10 - Mar 21, 2026). 4 measurements flagged as outliers.
>
> **Key Findings**:
> - Phi2 showed significant treatment effects (F=12.34, p<0.001)
> - High-N treatment (A) had 24% higher Phi2 than control (D)
> - Temporal trend shows treatment differences emerging after week 3
>
> Want me to add the full ANOVA table and time series plot? I can export this as PDF or share it with your team on the platform."

### What it takes to build

- **Report template engine**: A templating system (e.g., `react-pdf` for PDF generation, or a server-side rendering pipeline) that takes structured data and produces formatted reports.
- **Data aggregation pipeline**: Queries across the experiment's tables to compute summaries, pull annotation counts, and gather metadata. Uses the same data access patterns as the statistical analysis feature.
- **Visualization snapshots**: Render existing chart configurations to static images (PNG/SVG) for embedding in reports. The web visualization renderers already exist; they need a headless rendering mode.
- **LLM narrative generation**: The agent writes the text sections -- summary, key findings, methods description -- based on the structured data. This is where the LLM adds the most value: turning numbers into readable science.
- **Export pipeline**: PDF generation service. Could use Puppeteer/Playwright for HTML-to-PDF, or a dedicated library like `@react-pdf/renderer`.
- **Data export integration**: The existing `data_export_task.py` in the data platform handles CSV exports. Reports would extend this with metadata and analysis results.

### How it fits

The experiment data export pipeline already exists (`experiment-data-exports.controller.ts`, `data_export_task.py`). Reports are an enriched version of exports that add narrative, visualizations, and statistics. They could be stored as experiment artifacts and shared via the platform's existing visibility/sharing controls.

---

## Architecture: How the Agent Fits Into openJII

### Agent service layer

```
                    +------------------+
                    |   Agent Service  |
                    |   (new package)  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     |  LLM API   |  | Tool Layer  |  | Vector Store|
     | (Claude /  |  | (functions) |  | (protocol & |
     |  GPT-4)    |  |             |  |  macro       |
     +------------+  +------+------+  |  embeddings) |
                            |         +--------------+
              +-------------+-------------+
              |             |             |
     +--------v--+  +------v------+ +----v---------+
     | Backend   |  | Databricks  | | Stats Engine |
     | API       |  | SQL Adapter | | (Python)     |
     | (NestJS)  |  |             | |              |
     +-----------+  +-------------+ +--------------+
```

The agent would be a new package (`packages/agent` or `apps/agent`) that:

1. **Receives user messages** via the backend API (a new WebSocket or REST endpoint)
2. **Calls the LLM** with the user's message, conversation history, and system context (current experiment, user role, available data)
3. **Executes tools** based on the LLM's function calls:
   - `query_experiment_data` -- runs SQL against Databricks
   - `search_protocols` -- semantic search over the protocol library
   - `get_compatible_macros` -- queries the protocol-macro join table
   - `create_visualization` -- generates a chart configuration
   - `run_statistical_test` -- executes ANOVA, t-test, etc.
   - `generate_layout` -- produces a randomized field layout
4. **Returns results** to the user with the LLM's interpretation

### Data flow for a typical interaction

1. User types: "Compare Phi2 across treatments"
2. Agent service receives the message with experiment context (experiment ID, user ID)
3. LLM decides to call `query_experiment_data` with a SQL query
4. Tool executes against Databricks, returns data
5. LLM decides to call `run_statistical_test` with the data
6. Stats engine returns ANOVA results
7. LLM decides to call `create_visualization` for a box plot
8. Tool creates the visualization config
9. LLM generates a natural language summary and returns everything to the user

### Where it surfaces in the UI

| Platform | Location | Primary capabilities |
|----------|----------|---------------------|
| Web - Experiment creation | Side panel in `/platform/experiments/new` | Design assistant, protocol finder |
| Web - Flow editor | Contextual in `/platform/experiments/[id]/flow` | Macro recommender, flow guidance |
| Web - Data explorer | Chat bar in `/platform/experiments/[id]/data` | Natural language queries, stats |
| Web - Analysis tab | Side panel in `/platform/experiments/[id]/analysis` | Visualization picker, reports |
| Mobile - Experiment selection | Help overlay | Onboarding, protocol finder |
| Mobile - Measurement flow | Inline tips | Guidance, troubleshooting |
| Global | Persistent chat button (bottom-right) | Any capability, context-dependent |

---

## Implementation Phases

### Phase 1: Foundation (4-6 weeks)

- Set up the agent service package with LLM integration (start with Claude API)
- Implement the tool-calling framework with 2-3 initial tools:
  - `query_experiment_data` (natural language querying)
  - `search_protocols` (protocol finder)
  - `get_compatible_macros` (macro recommender)
- Build the chat UI component for the web platform (side panel)
- Basic conversation memory (per-session, stored in memory)

### Phase 2: Analysis & Visualization (4-6 weeks)

- Statistical analysis engine (Python microservice)
- Visualization template picker with config generation
- Report generation (HTML/PDF)
- Persist conversation history per experiment

### Phase 3: Design & Onboarding (3-4 weeks)

- Experiment design assistant with layout generation
- Onboarding state machine and guided flows
- Mobile app integration (chat component in React Native)

### Phase 4: Advanced Features (ongoing)

- Heritability calculations
- Genetic marker integration
- Cross-experiment analysis ("Compare this experiment with last season's")
- Agent-generated experimental design suggestions based on historical data

---

## Key Technical Decisions

### LLM choice

Start with Claude (Anthropic) for its strong tool-calling capabilities and long context windows. The architecture should be LLM-agnostic -- the tool layer is independent of the LLM provider.

### Vector store for semantic search

Use pgvector (PostgreSQL extension) to keep the infrastructure simple. The protocol and macro libraries are small enough (hundreds to low thousands of records) that a dedicated vector database is unnecessary.

### Statistical computation

Do not rely on the LLM for statistical calculations. Use a deterministic Python stats service that the LLM calls as a tool. The LLM's job is to choose the right test, construct the call, and interpret the results -- not to compute p-values.

### Security and data access

The agent operates with the same permissions as the authenticated user. It cannot access experiments the user doesn't have access to. All SQL queries are scoped to the experiment's schema in Unity Catalog. The agent never exposes raw credentials or internal infrastructure details.

### Cost management

LLM calls are expensive at scale. Mitigate with:
- Caching common queries and their results
- Using smaller/faster models for simple tasks (routing, classification) and larger models for complex tasks (code generation, statistical interpretation)
- Rate limiting per user/experiment
- Tracking token usage per interaction for cost attribution

---

## Open Questions

1. **Should the agent have write access?** Currently scoped as read-only for data, but it needs write access to create visualizations, save layouts, and add protocols to experiments. Require explicit user confirmation for all write operations.

2. **How much domain knowledge should be in the system prompt vs. retrieved?** Plant physiology knowledge (what Phi2 means, how photosynthesis works) could be baked into the system prompt or retrieved from a knowledge base. System prompt is simpler but costs more tokens per call.

3. **Mobile agent scope**: The mobile app is offline-first. Should the agent work offline? This would require a local/edge model, which is significantly more complex. Initial recommendation: agent requires network connectivity on mobile.

4. **Multi-language support**: The platform supports i18n (via the `packages/i18n` package). The agent should respond in the user's preferred language. Most modern LLMs handle this well, but statistical terminology varies across languages.
