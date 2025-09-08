"use client";

import { Upload } from "lucide-react";
import React, { useCallback, useRef } from "react";

import { cn } from "../../lib/utils";

export interface FileUploadProps {
  /**
   * Files currently selected
   */
  files: File[] | FileList | null;

  /**
   * Callback when files are selected/dropped
   */
  onFilesChange: (files: FileList | null) => void;

  /**
   * Whether the upload is in progress
   */
  isUploading?: boolean;

  /**
   * Whether to allow directory uploads (webkitdirectory)
   */
  allowDirectories?: boolean;

  /**
   * Custom class name for the dropzone container
   */
  className?: string;

  /**
   * Custom content for the dropzone
   */
  children?: React.ReactNode;

  /**
   * Whether to show file list
   */
  showFileList?: boolean;

  /**
   * Whether to allow multiple files
   */
  multiple?: boolean;

  /**
   * Placeholder text when no files are selected
   */
  placeholder?: string;

  /**
   * Text to show when files are selected
   */
  selectedText?: string;

  /**
   * Browse instruction text
   */
  browseInstruction?: string;

  /**
   * Text for selected files count
   */
  selectedFilesText?: string;

  /**
   * Validation title text
   */
  validationTitle?: string;

  /**
   * Validation errors to display (with translated messages)
   */
  validationErrors?: string[];

  /**
   * Upload error message
   */
  uploadError?: string | null;

  /**
   * Icon to display in the upload area
   */
  icon?: React.ReactNode;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      files,
      onFilesChange,
      isUploading = false,
      className,
      children,
      showFileList = true,
      multiple = true,
      allowDirectories = false,
      placeholder = "Click to select files or drag and drop",
      selectedText = "Change selection",
      browseInstruction = "Browse and select files",
      selectedFilesText = "Selected files",
      validationTitle = "Validation errors",
      validationErrors = [],
      uploadError = null,
      icon,
      ...props
    },
    ref,
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(
      (selectedFiles: FileList | null) => {
        onFilesChange(selectedFiles);
      },
      [onFilesChange],
    );

    const filesArray = files ? Array.from(files) : [];
    const hasFiles = filesArray.length > 0;

    return (
      <div className={cn("space-y-4", className)} ref={ref} {...props}>
        <div
          className="hover:border-primary/50 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            {...(allowDirectories
              ? ({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)
              : {})}
            multiple={multiple}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={isUploading}
          />

          {children || (
            <div className="flex flex-col items-center justify-center space-y-2">
              {icon || <Upload className="h-8 w-8 text-gray-400" />}
              <div>
                <p className="text-sm font-medium">{hasFiles ? selectedText : placeholder}</p>
                <p className="text-xs text-gray-500">{browseInstruction}</p>
              </div>
            </div>
          )}
        </div>

        {showFileList && hasFiles && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-2 text-sm font-medium">{selectedFilesText}</p>
            <div className="max-h-32 overflow-y-auto">
              {filesArray.map((file, index) => (
                <p key={index} className="truncate text-xs text-gray-600">
                  {(file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name}
                </p>
              ))}
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <h4 className="mb-1 text-sm font-medium text-red-800">{validationTitle}</h4>
            <ul className="space-y-1 text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {uploadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{uploadError}</p>
          </div>
        )}
      </div>
    );
  },
);

FileUpload.displayName = "FileUpload";
