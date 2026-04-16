# Metadata

Metadata turns raw sensor readings into meaningful, analysable data. By attaching information such as genotype, treatment group, or planting date to each measurement, you make it possible to filter, compare, and draw conclusions from your experiment.

## Why metadata matters

Sensor data alone tells you *what* was measured, but not *why* or *under which conditions*. Metadata bridges that gap:

- **Filter and group:** Compare genotypes, treatments (e.g. stress vs. control), or time points side by side.
- **Enable analysis:** Most statistical analyses require at least one grouping variable. Without metadata you cannot run an ANOVA, build a regression, or produce meaningful plots.
- **Support FAIR and open data:** The [FAIR principles](../../introduction/glossary-terminology#fair-principles) (Findable, Accessible, Interoperable, Reusable) require that data is described with rich metadata so that other researchers can discover, understand, and reuse it. Adding context now saves everyone time later.

### Common examples

| Column | Purpose | Example values |
|:---|:---|:---|
| `plant_id` | Unique identifier per plant or plot | `P001`, `P002`, `A-12` |
| `genotype` | Genetic background or cultivar | `Col-0`, `Ler`, `Nipponbare` |
| `treatment` | Experimental condition | `control`, `drought`, `high-light` |
| `block` | Field or greenhouse block | `B1`, `B2` |
| `sowing_date` | Date the plant was sown | `2025-03-15` |
| `harvest_date` | Date of harvest or final measurement | `2025-06-20` |

You can add any columns that are relevant to your experiment. There is no fixed schema.

## How it works

When you save metadata, the platform joins it to your measurement data using a shared **identifier column** (for example `plant_id` that matches an answer to one of your experiment's [Questions](./0013-create-add-experiment.md)). The joined columns then appear alongside sensor readings in the **Data** tab and in all exports.

## Import metadata

1. Open your experiment and go to the **Data** tab.
2. Click **Upload Data** and choose **Plot/Plant Metadata**.
3. In the Import Metadata dialog you have three ways to bring data in:

   - **Upload a file** — drag-and-drop or browse for a CSV, TSV, or Excel file (.xlsx, .xls).
   - **Paste from Clipboard** — copy a range from a spreadsheet (Excel, Google Sheets, etc.) and click **Paste from Clipboard**.
   - **Keyboard paste** — press **Ctrl+V** (or **Cmd+V** on Mac) directly in the dialog.

4. After import you will see a table preview. Review the data and use the editing tools to make adjustments if needed (see below).
5. Choose the **Identifier column** — the column whose values match an existing Question in your measurement flow.
6. Optionally link the identifier to a specific **Question** so the platform knows how to join.
7. Click **Save Metadata**.

After saving, metadata columns will appear in the Data tab and be included in exports on the next processing interval.

## Edit metadata

Once data is imported you can refine it before saving:

- **Add or remove rows** using the row controls.
- **Add or remove columns** by clicking the column header menu.
- **Rename columns** by clicking a column header.
- **Mark the identifier column** — this tells the platform which column to use for joining.
- **Replace or clear** the imported data to start over.

## Tips

- Use short, consistent column names — they become column headers in exports and plots.
- Make sure your identifier values exactly match the answers recorded during measurement (e.g. if the mobile app records `P001`, use `P001` in metadata, not `p001` or `Plant 001`).
- You can update metadata at any time by uploading a new version; the old version will be replaced.
- Keep one metadata table per logical grouping. For example, one table for genotype information and another for harvest data if they come from different sources.
