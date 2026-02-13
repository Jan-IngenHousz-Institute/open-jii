# Metadata Table Component

Editable table component for managing plot/plant metadata in experiments.

## Features

- Import data from CSV, TSV, or Excel files
- Paste data directly from clipboard (Excel/Google Sheets compatible)
- Edit cells inline
- Add/delete rows and columns
- Configure merge with experiment data via identifier columns
- Project admin only access control

## Usage

```tsx
import {
  MetadataProvider,
  MetadataTable,
  MetadataTableToolbar,
  MergeConfigDialog,
} from "@/components/metadata-table";

function ExperimentMetadataPage({ experimentId }: { experimentId: string }) {
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const isAdmin = useIsProjectAdmin(); // your auth hook

  const handleSave = async (columns, rows) => {
    // Call your API to save metadata
    await api.experiments.saveMetadata({ experimentId, columns, rows });
  };

  const handleMerge = async () => {
    // Merge metadata with experiment data
    // Access mergeConfig from context for identifier columns
  };

  return (
    <MetadataProvider experimentId={experimentId} onSave={handleSave}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2>Plot Metadata</h2>
          <MetadataTableToolbar disabled={!isAdmin} />
        </div>
        
        <MetadataTable disabled={!isAdmin} />
        
        <Button onClick={() => setMergeDialogOpen(true)}>
          Configure Merge
        </Button>
        
        <MergeConfigDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          experimentColumns={[
            { id: "plot", name: "Plot" },
            { id: "plant_id", name: "Plant ID" },
          ]}
          onConfirm={handleMerge}
        />
      </div>
    </MetadataProvider>
  );
}
```

## Context API

The `useMetadata()` hook provides:

```ts
interface MetadataContextValue {
  // State
  state: { columns, rows, isDirty };
  
  // Data manipulation
  setData(columns, rows): void;
  updateCell(rowId, columnId, value): void;
  addRow(): void;
  deleteRow(rowId): void;
  addColumn(column): void;
  deleteColumn(columnId): void;
  renameColumn(columnId, newName): void;
  
  // Import
  importFromClipboard(): Promise<void>;
  importFromFile(file: File): Promise<void>;
  
  // Merge config
  mergeConfig: { identifierColumn, experimentIdentifierColumn } | null;
  setMergeConfig(config): void;
  
  // Save
  save(): Promise<void>;
  isSaving: boolean;
}
```

## Supported Import Formats

- CSV (comma-separated)
- TSV (tab-separated)
- Excel (.xlsx, .xls)
- Clipboard paste (auto-detects delimiter)

## Column Types

Columns are auto-typed based on data:
- `string` - default
- `number` - all values are numeric
- `date` - ISO date format detected
