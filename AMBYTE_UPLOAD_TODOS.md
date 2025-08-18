# Ambyte Upload Feature - Known Issues & TODOs

## 🚨 Critical Issues

### 1. Double Alert Prompts on File Upload
**Status:** 🔴 Unresolved  
**Description:** Two alert prompts appear when attempting to upload files, causing poor UX.

**Investigation needed:**
- [ ] Check if alerts are coming from browser security warnings
- [ ] Verify if multiple event listeners are attached
- [ ] Test with different browsers (Chrome, Firefox, Safari)
- [ ] Consider if `webkitdirectory` attribute is triggering browser warnings

**Potential Solutions:**
- [ ] Add `pointer-events: none` to input element during drag operations
- [ ] Use `document.addEventListener` with `{ once: true }` option
- [ ] Implement custom file picker using File System Access API (if supported)
- [ ] Add debouncing to event handlers

### 2. Backend API Mismatch
**Status:** 🔴 Unresolved  
**Description:** Backend throws errors on file upload due to filename validation mismatch.

**Root Cause Identified:**
- **Backend expects:** Single file with name pattern `Ambyte_X` or `[1-4]` (without .zip)
- **Frontend sends:** Either first file only OR `ambyte-data.zip` for multiple files
- **Validation fails:** Backend `validateFileName()` rejects `ambyte-data.zip`

**Current Upload Flow Issues:**
```typescript
// Frontend creates:
{
  name: "ambyte-data.zip", // ❌ Fails backend validation
  data: Buffer.from(zipBuffer)
}

// Backend expects:
{
  name: "Ambyte_10", // ✅ Passes validation  
  data: Buffer.from(zipBuffer) // ✅ Correct format
}
```

**Required Fixes:**
- [ ] **Frontend:** Extract proper folder name from FileList paths (e.g., from `Ambyte_10/1/file.txt` → `Ambyte_10`)
- [ ] **Frontend:** Use detected folder name instead of generic `ambyte-data.zip`
- [ ] **Frontend:** Implement proper JSZip library for zip creation (currently using single file)
- [ ] **Backend:** Update validation to accept `.zip` extension OR
- [ ] **Backend:** Remove `.zip` extension before validation

**Filename Detection Logic Needed:**
```typescript
function extractAmbyteRootFolder(files: FileList): string {
  // From "Ambyte_10/1/file.txt" → "Ambyte_10"
  // From "1/file.txt" → "1" 
  for (const file of files) {
    if (file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split('/');
      if (parts[0].match(/^Ambyte_\d+$/)) return parts[0];
      if (parts[0].match(/^[1-4]$/)) return parts[0];
    }
  }
  throw new Error("No valid Ambyte folder structure detected");
}
```

**Files to Update:**
- [ ] `apps/web/hooks/experiment/useAmbyteUpload/useAmbyteUpload.ts` - Fix filename logic
- [ ] `apps/backend/src/experiments/application/use-cases/experiment-data/upload-ambyte-data.ts` - Update validation
- [ ] Add JSZip dependency for proper zip creation

## 🧹 Code Quality & Cleanup

### 3. File Upload Component Cleanup
**Status:** 🟡 In Progress

**Tasks:**
- [ ] Remove duplicate code in drag event handlers
- [ ] Standardize error handling patterns
- [ ] Add proper TypeScript types for all props
- [ ] Remove unused imports and variables
- [ ] Add JSDoc comments for complex functions
- [ ] Extract magic strings to constants

**Files to Clean:**
- `packages/ui/src/components/file-upload/file-upload.tsx`
- `apps/web/components/experiment-data/ambyte-upload-modal/ambyte-upload-modal.tsx`

### 4. Validation Logic Improvements
**Status:** 🟡 Needs Enhancement

**Current Issues:**
- [ ] Validation rules are hardcoded
- [ ] Error messages could be more specific
- [ ] Missing file size validation
- [ ] No duplicate file detection

**Improvements Needed:**
```typescript
interface ValidationConfig {
  maxFileSize: number; // bytes
  allowedExtensions: string[];
  requiredFiles: string[]; // e.g., ['config.txt', 'run.txt']
  maxTotalSize: number;
  folderStructurePattern: RegExp;
}
```

## 🧪 Test Coverage Extension

### 5. Expand Test Suite
**Status:** 🟡 Partially Complete  
**Current Coverage:** 17 tests passing

**Missing Test Cases:**

#### File Upload Component Tests
- [ ] Drag and drop functionality (non-directory mode)
- [ ] File size validation
- [ ] File type validation
- [ ] Multiple file selection
- [ ] Progress indicator behavior
- [ ] Error state recovery
- [ ] Accessibility features (keyboard navigation, screen readers)

#### Ambyte Upload Modal Tests
- [ ] **Backend integration tests** (with mocked API):
  - [ ] Successful upload with valid Ambyte_X folder
  - [ ] Successful upload with single numbered folder (1-4)
  - [ ] Failed upload with invalid filename
  - [ ] Failed upload with network error
  - [ ] Upload progress tracking
  - [ ] Upload cancellation
- [ ] **File validation edge cases**:
  - [ ] Empty folders (should fail)
  - [ ] Corrupted files (should fail)
  - [ ] Files with special characters in names
  - [ ] Very large files (>100MB)
  - [ ] Nested folder structures beyond expected depth
  - [ ] Mixed valid/invalid file types
  - [ ] Duplicate file names
  - [ ] Files with no extension
  - [ ] Binary files in folder structure
- [ ] **Folder structure validation**:
  - [ ] `Ambyte_1/` through `Ambyte_999/` patterns
  - [ ] Single numbered folders (`1/`, `2/`, `3/`, `4/`)
  - [ ] Invalid folder names (`Ambyte_X_backup/`, `5/`, `0/`)
  - [ ] Multiple Ambyte folders in one upload
  - [ ] Mixed folder types (Ambyte_10 + 1/ together)
- [ ] **File content validation**:
  - [ ] Valid .txt files with expected content
  - [ ] Required files present (config.txt, run.txt, ambyte_log.txt)
  - [ ] Missing required files
  - [ ] Extra unexpected files (should be allowed)
  - [ ] Empty .txt files
  - [ ] Non-UTF8 encoded files
- [ ] **Error boundary testing**:
  - [ ] Network failures during upload
  - [ ] Server 500 errors
  - [ ] Authentication failures
  - [ ] Permission denied errors
  - [ ] Timeout errors
- [ ] **UI state management**:
  - [ ] Loading states during upload
  - [ ] Progress indicators
  - [ ] Error state recovery (retry button)
  - [ ] Success state handling
  - [ ] Modal close behavior in each state
- [ ] **Accessibility testing**:
  - [ ] Screen reader announcements for upload progress
  - [ ] Keyboard navigation through upload flow
  - [ ] Focus management during state changes
  - [ ] Error announcements

#### Integration Tests
- [ ] End-to-end upload flow
- [ ] Error recovery flows
- [ ] Browser compatibility tests
- [ ] Performance tests with large file sets

**Test Files to Extend:**
```
apps/web/components/experiment-data/ambyte-upload-modal/
├── ambyte-upload-modal.test.tsx (✅ existing)
├── ambyte-upload-modal.integration.test.tsx (🆕 new)
└── ambyte-upload-modal.e2e.test.tsx (🆕 new)

packages/ui/src/components/file-upload/
├── file-upload.test.tsx (🆕 new)
└── file-upload.accessibility.test.tsx (🆕 new)
```

## 🔧 Technical Debt

### 6. Performance Optimizations
**Status:** 🟡 Future Enhancement

**Areas for Improvement:**
- [ ] Implement file chunking for large uploads
- [ ] Add upload progress indicators
- [ ] Implement resume functionality for failed uploads
- [ ] Add client-side file compression
- [ ] Optimize re-renders in file validation

### 7. Accessibility Improvements
**Status:** 🟡 Needs Assessment

**Required Audits:**
- [ ] Screen reader compatibility
- [ ] Keyboard navigation
- [ ] ARIA labels and descriptions
- [ ] Color contrast compliance
- [ ] Focus management during upload flow

### 8. Browser Compatibility
**Status:** 🟡 Needs Testing

**Browsers to Test:**
- [ ] Chrome 90+ (primary)
- [ ] Firefox 85+ 
- [ ] Safari 14+
- [ ] Edge 90+

**Features Requiring Polyfills:**
- [ ] `webkitdirectory` support
- [ ] File System Access API
- [ ] Drag and Drop API edge cases

## 📋 Documentation

### 9. User Documentation
**Status:** 🔴 Missing

**Required Documents:**
- [ ] User guide for Ambyte folder upload
- [ ] Supported file formats documentation
- [ ] Troubleshooting guide
- [ ] FAQ for common upload issues

### 10. Developer Documentation
**Status:** 🟡 Partial

**Required Documents:**
- [ ] API documentation for upload endpoints
- [ ] File validation rules documentation
- [ ] Component architecture diagram
- [ ] Error handling patterns guide

## 🚀 Future Enhancements

### 11. Advanced Features (Post-MVP)
**Status:** 🔵 Future Consideration

**Potential Features:**
- [ ] Batch upload multiple Ambyte folders
- [ ] Upload preview with file tree visualization
- [ ] Cloud storage integration (S3, Google Drive)
- [ ] Upload scheduling/queuing
- [ ] Automatic file validation and repair
- [ ] Upload analytics and monitoring

## 📊 Success Criteria

**Definition of Done for this branch:**
- [ ] ✅ No alert prompts during file upload
- [ ] ✅ Backend successfully processes uploads without errors
- [ ] ✅ All existing tests pass
- [ ] ✅ Code passes linting and formatting checks
- [ ] ✅ Test coverage above 80% for upload components
- [ ] ✅ Manual testing completed across major browsers
- [ ] ✅ Documentation updated

## 🔗 Related Issues/PRs

**GitHub Issues:**
- [ ] Link to drag-and-drop issue
- [ ] Link to backend API mismatch issue
- [ ] Link to test coverage issue

**Dependencies:**
- [ ] Backend API changes (if required)
- [ ] Design system updates (if needed)
- [ ] Database schema changes (if applicable)

---

**Last Updated:** August 18, 2025  
**Branch:** `feature/frontent-ambyte-data-ingestion`  
**Priority:** High (blocking release)
