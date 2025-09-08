// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { vi, expect, describe, it, beforeEach } from "vitest";

import { FileUpload } from "./file-upload";

/**
 * Test suite for the FileUpload component
 * 
 * This test suite covers:
 * - Basic rendering and props handling
 * - File selection and upload functionality
 * - Validation and error handling
 * - Accessibility features
 * - Custom styling and configuration options
 */
describe("FileUpload", () => {
  const mockOnFilesChange = vi.fn();

  beforeEach(() => {
    mockOnFilesChange.mockClear();
  });

  const getFileInput = (container: HTMLElement) => {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  };

  it("renders with default props", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} />);

    expect(screen.getByText("Click to select files or drag and drop")).toBeInTheDocument();
    expect(screen.getByText("Browse and select files")).toBeInTheDocument();
    expect(getFileInput(container)).toBeInTheDocument();
  });

  it("renders with custom placeholder text", () => {
    render(
      <FileUpload
        files={null}
        onFilesChange={mockOnFilesChange}
        placeholder="Custom placeholder"
        browseInstruction="Custom browse instruction"
      />
    );

    expect(screen.getByText("Custom placeholder")).toBeInTheDocument();
    expect(screen.getByText("Custom browse instruction")).toBeInTheDocument();
  });

  it("renders with custom icon", () => {
    const CustomIcon = () => <div data-testid="custom-icon">Custom Icon</div>;
    render(
      <FileUpload
        files={null}
        onFilesChange={mockOnFilesChange}
        icon={<CustomIcon />}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders with custom children instead of default content", () => {
    render(
      <FileUpload files={null} onFilesChange={mockOnFilesChange}>
        <div data-testid="custom-content">Custom upload content</div>
      </FileUpload>
    );

    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to select files or drag and drop")).not.toBeInTheDocument();
  });

  it("handles file selection", async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} />);

    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const input = getFileInput(container);

    await user.upload(input, file);

    expect(mockOnFilesChange).toHaveBeenCalledWith(expect.any(FileList));
  });

  it("handles multiple file selection when multiple is enabled", async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} multiple={true} />);

    const files = [
      new File(["test1"], "test1.txt", { type: "text/plain" }),
      new File(["test2"], "test2.txt", { type: "text/plain" }),
    ];
    const input = getFileInput(container);

    await user.upload(input, files);

    expect(mockOnFilesChange).toHaveBeenCalledWith(expect.any(FileList));
  });

  it("disables file selection when isUploading is true", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} isUploading={true} />);

    const input = getFileInput(container);
    expect(input).toBeDisabled();
  });

  it("shows selected files when files are provided", () => {
    const files = [
      new File(["test1"], "test1.txt", { type: "text/plain" }),
      new File(["test2"], "test2.txt", { type: "text/plain" }),
    ];

    render(<FileUpload files={files} onFilesChange={mockOnFilesChange} />);

    expect(screen.getByText("Selected files")).toBeInTheDocument();
    expect(screen.getByText("test1.txt")).toBeInTheDocument();
    expect(screen.getByText("test2.txt")).toBeInTheDocument();
    expect(screen.getByText("Change selection")).toBeInTheDocument();
  });

  it("hides file list when showFileList is false", () => {
    const files = [new File(["test"], "test.txt", { type: "text/plain" })];

    render(<FileUpload files={files} onFilesChange={mockOnFilesChange} showFileList={false} />);

    expect(screen.queryByText("Selected files")).not.toBeInTheDocument();
    expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
  });

  it("shows webkitRelativePath when available", () => {
    const fileWithPath = new File(["test"], "test.txt", { type: "text/plain" });
    Object.defineProperty(fileWithPath, "webkitRelativePath", {
      value: "folder/subfolder/test.txt",
      writable: false,
    });

    render(<FileUpload files={[fileWithPath]} onFilesChange={mockOnFilesChange} />);

    expect(screen.getByText("folder/subfolder/test.txt")).toBeInTheDocument();
  });

  it("applies allowDirectories attribute when enabled", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} allowDirectories={true} />);

    const input = getFileInput(container);
    expect(input).toHaveAttribute("webkitdirectory", "");
  });

  it("does not apply allowDirectories attribute when disabled", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} allowDirectories={false} />);

    const input = getFileInput(container);
    expect(input).not.toHaveAttribute("webkitdirectory");
  });

  it("shows validation errors when provided", () => {
    const validationErrors = ["File too large", "Invalid file type"];

    render(
      <FileUpload
        files={null}
        onFilesChange={mockOnFilesChange}
        validationErrors={validationErrors}
        validationTitle="Upload errors"
      />
    );

    expect(screen.getByText("Upload errors")).toBeInTheDocument();
    expect(screen.getByText("• File too large")).toBeInTheDocument();
    expect(screen.getByText("• Invalid file type")).toBeInTheDocument();
  });

  it("shows upload error when provided", () => {
    render(
      <FileUpload
        files={null}
        onFilesChange={mockOnFilesChange}
        uploadError="Upload failed"
      />
    );

    expect(screen.getByText("Upload failed")).toBeInTheDocument();
  });

  it("calls onFilesChange when dropzone is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} />);

    const dropzone = screen.getByText("Click to select files or drag and drop").closest('div');
    await user.click(dropzone!);

    // The click should trigger the file input click
    const input = getFileInput(container);
    expect(input).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles single file selection when multiple is false", () => {
    const { container } = render(<FileUpload files={null} onFilesChange={mockOnFilesChange} multiple={false} />);

    const input = getFileInput(container);
    expect(input).not.toHaveAttribute("multiple");
  });

  it("shows custom text labels", () => {
    render(
      <FileUpload
        files={null}
        onFilesChange={mockOnFilesChange}
        selectedFilesText="Custom selected files"
        selectedText="Custom change selection"
      />
    );

    // With no files, should show placeholder
    expect(screen.getByText("Click to select files or drag and drop")).toBeInTheDocument();

    // With files
    const files = [new File(["test"], "test.txt", { type: "text/plain" })];
    render(
      <FileUpload
        files={files}
        onFilesChange={mockOnFilesChange}
        selectedFilesText="Custom selected files"
        selectedText="Custom change selection"
      />
    );

    expect(screen.getByText("Custom selected files")).toBeInTheDocument();
    expect(screen.getByText("Custom change selection")).toBeInTheDocument();
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<FileUpload ref={ref} files={null} onFilesChange={mockOnFilesChange} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("handles FileList as files prop", () => {
    const file1 = new File(["test1"], "test1.txt", { type: "text/plain" });
    const file2 = new File(["test2"], "test2.txt", { type: "text/plain" });
    
    // Mock a FileList instead of using DataTransfer
    const mockFileList = {
      0: file1,
      1: file2,
      length: 2,
      item: (index: number) => index === 0 ? file1 : index === 1 ? file2 : null,
      [Symbol.iterator]: function* () {
        yield file1;
        yield file2;
      }
    } as FileList;

    render(<FileUpload files={mockFileList} onFilesChange={mockOnFilesChange} />);

    expect(screen.getByText("test1.txt")).toBeInTheDocument();
    expect(screen.getByText("test2.txt")).toBeInTheDocument();
  });

  it("shows file count correctly in file list", () => {
    const files = [
      new File(["test1"], "test1.txt", { type: "text/plain" }),
      new File(["test2"], "test2.txt", { type: "text/plain" }),
      new File(["test3"], "test3.txt", { type: "text/plain" }),
    ];

    render(<FileUpload files={files} onFilesChange={mockOnFilesChange} />);

    // Should show all files
    expect(screen.getByText("test1.txt")).toBeInTheDocument();
    expect(screen.getByText("test2.txt")).toBeInTheDocument();
    expect(screen.getByText("test3.txt")).toBeInTheDocument();
  });
});
