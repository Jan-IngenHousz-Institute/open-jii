"use client";

import { Upload, X, FileIcon, Loader2, AlertCircle } from "lucide-react";
import * as React from "react";

import { cva, type VariantProps } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { Button } from "../button";
import { Progress } from "../progress";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const fileUploadVariants = cva(
  "relative rounded-lg border-2 border-dashed transition-colors min-h-[200px] flex flex-col items-center justify-center p-6",
  {
    variants: {
      state: {
        default: "border-muted-foreground/25 hover:border-primary/50",
        active: "border-primary bg-primary/5",
        disabled: "cursor-not-allowed opacity-50",
        loading: "cursor-wait",
        error: "border-destructive bg-destructive/5",
        success: "border-green-500 bg-green-50 dark:bg-green-950/20",
      },
      size: {
        sm: "min-h-[150px] p-4",
        default: "min-h-[200px] p-6",
        lg: "min-h-[250px] p-8",
      },
    },
    defaultVariants: {
      state: "default",
      size: "default",
    },
  },
);

export interface FileUploadProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fileUploadVariants> {
  onFileSelect: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  maxSize?: number;
  maxFiles?: number;
  validator?: (files: FileList) => ValidationResult;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  progress?: number;
}

export function FileUpload({
  onFileSelect,
  accept,
  multiple = false,
  directory = false,
  maxSize,
  maxFiles,
  validator,
  disabled = false,
  loading = false,
  error,
  progress,
  size,
  className,
  children,
  ...props
}: FileUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

  const currentState = React.useMemo(() => {
    if (disabled) return "disabled";
    if (loading) return "loading";
    if (error || validationErrors.length > 0) return "error";
    if (selectedFiles && selectedFiles.length > 0) return "success";
    if (isDragOver) return "active";
    return "default";
  }, [disabled, loading, error, validationErrors.length, selectedFiles, isDragOver]);

  // Debug effect to check browser support
  React.useEffect(() => {
    if (fileInputRef.current && directory) {
      // Ensure webkitdirectory is properly set for folder selection
      fileInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, [directory]);

  const validateFiles = React.useCallback(
    (files: FileList): ValidationResult => {
      const errors: string[] = [];

      // File count validation
      if (maxFiles && files.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
      }

      // File size validation
      if (maxSize) {
        const oversizedFiles = Array.from(files).filter((file) => file.size > maxSize);
        if (oversizedFiles.length > 0) {
          errors.push(`Files exceed maximum size of ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
        }
      }

      // Custom validation
      if (validator) {
        const customResult = validator(files);
        if (!customResult.isValid) {
          errors.push(...customResult.errors);
        }
      }

      return { isValid: errors.length === 0, errors };
    },
    [maxFiles, maxSize, validator],
  );

  const handleFileSelection = React.useCallback(
    (files: FileList | null) => {
      if (!files || disabled) return;

      const validation = validateFiles(files);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setSelectedFiles(null);
        onFileSelect(null);
        return;
      }

      setValidationErrors([]);
      setSelectedFiles(files);
      onFileSelect(files);
    },
    [disabled, validateFiles, onFileSelect],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled) {
      // For folder drops, we need to use webkitGetAsEntry if available
      if (directory && e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        const entries = items.map(item => item.webkitGetAsEntry?.());
        
        // Check if we have directory entries
        const hasDirectories = entries.some(entry => entry?.isDirectory);
        
        if (hasDirectories) {
          // For directories, we need to let the user know to use click selection
          // as drag and drop doesn't properly support folder traversal
          alert("Please use the 'click to browse' option for folder selection. Drag and drop doesn't fully support folder structures.");
          return;
        }
      }
      
      handleFileSelection(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleClear = () => {
    setSelectedFiles(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileSelect(null);
  };

  const renderContent = () => {
    if (children) {
      return children;
    }

    if (currentState === "error") {
      return (
        <div className="text-center">
          <AlertCircle className="text-destructive mx-auto mb-4 h-12 w-12" />
          <h3 className="text-destructive mb-2 text-lg font-medium">Upload Error</h3>
          <p className="text-muted-foreground text-sm">Click to try again</p>
        </div>
      );
    }

    if (currentState === "loading") {
      return (
        <div className="text-center">
          <Loader2 className="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
          <h3 className="mb-2 text-lg font-medium">
            {progress !== undefined ? "Uploading..." : "Processing files..."}
          </h3>
          {progress !== undefined && (
            <div className="mx-auto w-full max-w-xs">
              <Progress value={progress} className="mb-2" />
              <p className="text-muted-foreground text-sm">{progress}%</p>
            </div>
          )}
        </div>
      );
    }

    if (selectedFiles && selectedFiles.length > 0) {
      return (
        <div className="text-center">
          <FileIcon className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h3 className="mb-2 text-lg font-medium text-green-700">
            {selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"} selected
          </h3>
          <Button variant="outline" size="sm" onClick={handleClear} className="mt-2">
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      );
    }

    if (isDragOver) {
      return (
        <div className="text-center">
          <Upload className="text-primary mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">Drop files here</h3>
        </div>
      );
    }

    return (
      <div className="text-center">
        <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-medium">
          {directory ? "Click to browse for a folder" : "Drag and drop your files here"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {directory ? "Folder drag and drop is not supported - please click to select" : "or click to browse"}
        </p>
      </div>
    );
  };

  const allErrors = [...(error ? [error] : []), ...validationErrors];

  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div
        className={fileUploadVariants({ state: currentState as any, size })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          {...(!directory && { accept })}
          {...(!directory && { multiple })}
          {...(directory && { webkitdirectory: "", multiple: true })}
          onChange={handleFileInputChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={disabled}
          aria-label={directory ? "Upload folder" : "Upload files"}
          aria-describedby={allErrors.length > 0 ? "file-upload-errors" : undefined}
        />
        {renderContent()}
      </div>

      {allErrors.length > 0 && (
        <div className="space-y-1" id="file-upload-errors">
          {allErrors.map((errorMsg, index) => (
            <p key={index} className="text-destructive text-sm">
              {errorMsg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export { fileUploadVariants };
