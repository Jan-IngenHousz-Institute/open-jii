# Question Card Component

A modular React component for creating and editing survey questions with multiple answer types.

## Structure

The QuestionCard component has been refactored into a modular folder structure where each component has its own folder with its test file:

```
question-card/
├── index.tsx                           # Public exports
├── README.md                           # This file
├── main/                               # Main QuestionCard component
│   ├── index.tsx
│   ├── question-card.tsx
│   └── question-card.test.tsx
├── text-answer-display/                # Text answer type display
│   ├── index.tsx
│   ├── text-answer-display.tsx
│   └── text-answer-display.test.tsx
├── number-answer-display/              # Number answer type display
│   ├── index.tsx
│   ├── number-answer-display.tsx
│   └── number-answer-display.test.tsx
├── boolean-answer-display/             # Boolean answer type display
│   ├── index.tsx
│   ├── boolean-answer-display.tsx
│   └── boolean-answer-display.test.tsx
├── select-options-editor/              # Multiple choice options editor
│   ├── index.tsx
│   ├── select-options-editor.tsx
│   └── select-options-editor.test.tsx
├── bulk-add-options-dialog/            # Bulk add dialog
│   ├── index.tsx
│   ├── bulk-add-options-dialog.tsx
│   └── bulk-add-options-dialog.test.tsx
└── delete-all-options-dialog/          # Delete confirmation dialog
    ├── index.tsx
    ├── delete-all-options-dialog.tsx
    └── delete-all-options-dialog.test.tsx
```

## Features

### Answer Types

- **TEXT**: Free text input
- **SELECT**: Multiple choice with customizable options
- **NUMBER**: Numeric input
- **BOOLEAN**: Yes/No choice

### Multiple Choice Features

1. **Individual Options Management**

   - Add options one at a time
   - Edit option text inline
   - Delete individual options
   - Options are numbered (1, 2, 3...) for clarity

2. **Bulk Add Options** ✨ NEW

   - Copy-paste multiple options at once
   - Each option on a new line
   - Perfect for importing from Excel/CSV files
   - Automatically filters empty lines
   - Modal dialog with clear instructions

3. **Delete All Options** ✨ NEW
   - Clear all options with one click
   - Confirmation dialog to prevent accidents
   - Shows count of options being deleted

## Usage

```tsx
import { QuestionCard } from "@/components/question-card";

function MyComponent() {
  const [question, setQuestion] = useState<QuestionUI>({
    answerType: "SELECT",
    validationMessage: "Choose a plot",
    options: ["Plot 1", "Plot 2"],
    required: true,
  });

  const handleBulkAdd = (newOptions: string[]) => {
    setQuestion({
      ...question,
      options: [...(question.options ?? []), ...newOptions],
    });
  };

  const handleDeleteAll = () => {
    setQuestion({
      ...question,
      options: [],
    });
  };

  return (
    <QuestionCard
      stepSpecification={question}
      onUpdateText={(text) => setQuestion({ ...question, validationMessage: text })}
      onUpdateAnswerType={(type) => setQuestion({ ...question, answerType: type })}
      onToggleRequired={() => setQuestion({ ...question, required: !question.required })}
      onAddOption={() => setQuestion({ ...question, options: [...(question.options ?? []), ""] })}
      onUpdateOption={(i, text) => {
        const newOptions = [...(question.options ?? [])];
        newOptions[i] = text;
        setQuestion({ ...question, options: newOptions });
      }}
      onDeleteOption={(i) => {
        setQuestion({ ...question, options: question.options?.filter((_, idx) => idx !== i) });
      }}
      onBulkAddOptions={handleBulkAdd}
      onDeleteAllOptions={handleDeleteAll}
    />
  );
}
```

## Props

### QuestionCard

| Prop                 | Type                                    | Description                        |
| -------------------- | --------------------------------------- | ---------------------------------- |
| `stepSpecification`  | `QuestionUI`                            | The question configuration object  |
| `onUpdateText`       | `(text: string) => void`                | Handler for question text changes  |
| `onUpdateAnswerType` | `(type: AnswerType) => void`            | Handler for answer type changes    |
| `onToggleRequired`   | `() => void`                            | Handler for toggling required flag |
| `onAddOption`        | `() => void`                            | Handler for adding a single option |
| `onUpdateOption`     | `(index: number, text: string) => void` | Handler for updating an option     |
| `onDeleteOption`     | `(index: number) => void`               | Handler for deleting an option     |
| `onBulkAddOptions`   | `(options: string[]) => void`           | Handler for bulk adding options    |
| `onDeleteAllOptions` | `() => void`                            | Handler for deleting all options   |
| `disabled`           | `boolean`                               | Whether the component is disabled  |

## Translations

The component uses i18n with keys under `questionCard.*`:

- `questionCard.bulkAddOptions` - Button text for bulk add
- `questionCard.deleteAllOptions` - Button text for delete all
- `questionCard.bulkAdd.*` - Keys for bulk add dialog
- `questionCard.deleteAll.*` - Keys for delete all dialog

See `packages/i18n/locales/*/experiments.json` for all translation keys.

## Design Decisions

### Numbered Options

Changed from alphabetical (A, B, C) to numeric (1, 2, 3) numbering as it:

- Scales better for large option lists
- Is more familiar to users
- Matches common survey conventions

### Bulk Add Feature

Designed specifically for experiment managers who need to:

- Import plot numbers from Excel/CSV files
- Add multiple measurement locations quickly
- Copy metadata from existing experiment plans

The textarea accepts one option per line, making it perfect for direct copy-paste from spreadsheet columns.

## Testing

All components have comprehensive test coverage. The test setup uses a global mock for i18n translation that simply returns the translation key:

```typescript
// test-setup.ts
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
```

This simplifies tests by removing the need to mock translations in each test file. Tests verify that the correct translation keys are used rather than the actual translated text.

Run tests with:

```bash
pnpm test question-card
```
