# @repo/ui

A reusable UI component library built with React, TypeScript, and Tailwind CSS.

## Components

### FileUpload

A flexible, accessible file upload component that supports both file and directory uploads with validation, drag & drop, and progress indication.

#### Features

- **File & Directory Support**: Uses `webkitdirectory` for folder uploads
- **Drag & Drop**: Intuitive drag and drop interface
- **Validation**: Built-in file size, count, and custom validation
- **Progress Indication**: Shows upload progress and loading states
- **Accessibility**: Full keyboard navigation and screen reader support
- **Variants**: Multiple size and state variants using class-variance-authority
- **Error Handling**: Comprehensive error display and retry functionality

#### Usage

```tsx
import { FileUpload } from "@repo/ui/components";

// Basic file upload
<FileUpload
  onFileSelect={handleFiles}
  accept=".jpg,.png"
  maxSize={10 * 1024 * 1024} // 10MB
/>

// Directory upload with validation
<FileUpload
  directory={true}
  onFileSelect={handleFiles}
  validator={customValidator}
  maxFiles={100}
  size="lg"
/>

// With custom content
<FileUpload onFileSelect={handleFiles}>
  <CustomUploadContent />
</FileUpload>
```

#### Props

| Prop           | Type                                    | Default     | Description                      |
| -------------- | --------------------------------------- | ----------- | -------------------------------- |
| `onFileSelect` | `(files: FileList \| null) => void`     | -           | Callback when files are selected |
| `accept`       | `string`                                | -           | File types to accept             |
| `multiple`     | `boolean`                               | `false`     | Allow multiple file selection    |
| `directory`    | `boolean`                               | `false`     | Enable directory/folder upload   |
| `maxSize`      | `number`                                | -           | Maximum file size in bytes       |
| `maxFiles`     | `number`                                | -           | Maximum number of files          |
| `validator`    | `(files: FileList) => ValidationResult` | -           | Custom validation function       |
| `disabled`     | `boolean`                               | `false`     | Disable the upload component     |
| `loading`      | `boolean`                               | `false`     | Show loading state               |
| `error`        | `string`                                | -           | External error message           |
| `progress`     | `number`                                | -           | Upload progress (0-100)          |
| `size`         | `'sm' \| 'default' \| 'lg'`             | `'default'` | Component size variant           |
| `className`    | `string`                                | -           | Additional CSS classes           |

## Testing

The package includes comprehensive Jest tests with @testing-library/react:

```bash
npm test          # Run tests
npm run test:watch  # Run tests in watch mode
```

## Development

Built with:

- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **class-variance-authority** - Component variants
- **Radix UI** - Accessible primitives
- **Lucide React** - Beautiful icons
