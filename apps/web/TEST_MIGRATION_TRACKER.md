# Test Migration Tracker

Status key: `[x]` = reviewed & done, `[-]` = needs changes, `[ ]` = not yet reviewed

### Violation codes (for `[-]` entries)

| Code          | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| HOOK_MOCK     | `vi.mock` of data-fetching hook — convert to `server.mount()`            |
| UI_MOCK       | Full `vi.mock("@repo/ui/components")` without `importOriginal` — Rule 7  |
| LUCIDE        | `vi.mock("lucide-react")` — Rule 7                                       |
| RHF_MOCK      | `vi.mock("react-hook-form")` — use `renderWithForm` from test-utils      |
| FIRE_EVENT    | Uses `fireEvent` — convert to `userEvent`                                |
| TYPE_CAST     | `as Protocol` / `as Macro` etc. — use factory functions                  |
| GLOBAL_REACT  | `globalThis.React = React` — remove (unnecessary)                        |
| USE_LOCALE    | `vi.mocked(useLocale)` — redundant (globally mocked)                     |
| LOCAL_RWF     | Local `renderWithForm` — import from `@/test/test-utils`                 |
| I18N_MOCK     | Custom `@repo/i18n` mock — remove (global mock returns key)              |
| TSR_MOCK      | `vi.mock("@/lib/tsr")` — use `server.mount()`                            |
| TL_IMPORT     | `@testing-library` import — use `@/test/test-utils`                      |
| INTERNAL_MOCK | `vi.mock` of internal util/module — only mock system boundaries          |
| INLINE_DATA   | Hand-crafted inline domain entity — use factory from `test/factories.ts` |
| RQ_MOCK       | `vi.mock("@tanstack/react-query")` — let real query infra run            |
| GLOBAL_REDECL | Re-declares a global mock from `test/setup.ts`                           |

---

## app/ pages & layouts (55/55 done)

- [x] app/[locale]/(auth)/login-error/page.test.tsx
- [x] app/[locale]/(auth)/login/page.test.tsx
- [x] app/[locale]/(auth)/register/page.test.tsx
- [x] app/[locale]/(auth)/verify-request/page.test.tsx
- [x] app/[locale]/(info)/about/page.test.tsx
- [x] app/[locale]/(info)/blog/[...notFound]/page.test.tsx
- [x] app/[locale]/(info)/blog/[slug]/page.test.tsx
- [x] app/[locale]/(info)/blog/not-found.test.tsx ← REFACTORED
- [x] app/[locale]/(info)/blog/page.test.tsx
- [x] app/[locale]/(info)/cookie-policy/page.test.tsx
- [x] app/[locale]/(info)/cookie-settings/page.test.tsx
- [x] app/[locale]/(info)/faq/page.test.tsx
- [x] app/[locale]/(info)/layout.test.tsx
- [x] app/[locale]/(info)/policies/page.test.tsx ← REFACTORED
- [x] app/[locale]/(info)/terms-and-conditions/page.test.tsx
- [x] app/[locale]/page.test.tsx
- [x] app/[locale]/platform/**tests**/not-found.test.tsx ← REFACTORED
- [x] app/[locale]/platform/account/settings/**tests**/layout.test.tsx
- [x] app/[locale]/platform/account/settings/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/analysis/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/analysis/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/analysis/visualizations/[visualizationId]/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/analysis/visualizations/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/data/**tests**/layout.test.tsx ← REFACTORED
- [-] app/[locale]/platform/experiments-archive/[id]/data/page.test.tsx ← HOOK_MOCK, INLINE_DATA (useExperiment + useExperimentTables should be server.mount; inline mockTablesData → createExperimentTable factory; redundant i18n mock removed)
- [x] app/[locale]/platform/experiments-archive/[id]/flow/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/[id]/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments-archive/page.test.tsx
- [x] app/[locale]/platform/experiments/[id]/analysis/layout.test.tsx
- [x] app/[locale]/platform/experiments/[id]/analysis/page.test.tsx
- [x] app/[locale]/platform/experiments/[id]/analysis/visualizations/[visualizationId]/edit/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/analysis/visualizations/[visualizationId]/page.test.tsx
- [x] app/[locale]/platform/experiments/[id]/analysis/visualizations/new/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/analysis/visualizations/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/data/**tests**/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/data/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/flow/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/experiments/[id]/layout.test.tsx ← uses server.mount
- [x] app/[locale]/platform/experiments/[id]/page.test.tsx ← uses server.mount
- [x] app/[locale]/platform/experiments/new/page.test.tsx
- [x] app/[locale]/platform/experiments/page.test.tsx
- [x] app/[locale]/platform/layout.test.tsx
- [x] app/[locale]/platform/macros/[id]/**tests**/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/macros/[id]/**tests**/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/macros/[id]/settings/**tests**/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/macros/**tests**/page.test.tsx
- [x] app/[locale]/platform/macros/new/**tests**/page.test.tsx
- [x] app/[locale]/platform/page.test.tsx
- [x] app/[locale]/platform/protocols/[id]/**tests**/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/protocols/new/page.test.tsx
- [x] app/[locale]/platform/protocols/page.test.tsx
- [x] app/[locale]/platform/transfer-request/history/page.test.tsx ← REFACTORED
- [x] app/[locale]/platform/transfer-request/layout.test.tsx ← REFACTORED
- [x] app/[locale]/platform/transfer-request/page.test.tsx ← REFACTORED
- [x] app/**tests**/layout.test.tsx
- [x] app/**tests**/locale-layout.test.tsx
- [x] app/**tests**/not-found.test.tsx
- [x] app/actions/auth.test.ts
- [x] app/actions/breadcrumbs.test.ts
- [x] app/actions/revalidate.test.ts

## components/ (138/138 done)

### Already reviewed & done

- [x] components/ExperimentStatusBadge.test.tsx
- [x] components/**tests**/list-experiments.test.tsx ← sibling mocks only
- [x] components/**tests**/macro-search-with-dropdown.test.tsx ← sibling mocks only
- [x] components/**tests**/protocol-search-with-dropdown.test.tsx ← sibling mocks only
- [x] components/**tests**/question-card.test.tsx
- [x] components/account-settings/**tests**/profile-card.test.tsx
- [x] components/account-settings/**tests**/profile-picture-card.test.tsx
- [x] components/account-settings/account-settings.test.tsx ← REFACTORED (server.mount, removed Form/Button/hook mocks)
- [x] components/account-settings/danger-zone-card.test.tsx ← REFACTORED (removed Dialog mock)
- [x] components/auth/auth-hero-section.test.tsx
- [x] components/auth/email-login-form.test.tsx ← pragmatic exception (InputOTP with importActual)
- [x] components/auth/error-content.test.tsx
- [x] components/auth/login-form.test.tsx ← sibling mocks only
- [x] components/auth/oauth-login-form.test.tsx
- [x] components/auth/registration-form.test.tsx ← REFACTORED (server.mount)
- [x] components/auth/terms-and-conditions-dialog.test.tsx ← system boundary mocks (contentful, @repo/cms)
- [x] components/cookie-banner.test.tsx ← system boundary mock (cookie-consent)
- [x] components/current-members-list/current-members-list.test.tsx ← REFACTORED (createUserProfile factory)
- [x] components/current-members-list/member-dialogs.test.tsx
- [x] components/current-members-list/member-item.test.tsx ← AUDIT FIX (inline mockUser → createUserProfile factory)
- [x] components/dashboard/blog-posts-section.test.tsx ← system boundary mocks (contentful, @repo/cms)
- [x] components/dashboard/dashboard-banner.test.tsx
- [x] components/dashboard/dashboard-section.test.tsx
- [x] components/dashboard/user-experiments-section.test.tsx ← sibling mock only
- [x] components/experiment-data/annotations/add-annotation-dialog.test.tsx ← REFACTORED (server.mount)
- [x] components/experiment-data/annotations/bulk-actions-bar.test.tsx ← REFACTORED
- [x] components/experiment-data/annotations/delete-annotations-dialog.test.tsx ← REFACTORED
- [x] components/experiment-data/data-upload-modal/data-upload-validation.test.ts
- [x] components/experiment-data/experiment-data-table-cell-collapsible.test.tsx ← sibling mocks only
- [-] components/experiment-data/table-cells/annotations/experiment-data-table-annotations-cell.test.tsx ← INTERNAL_MOCK (vi.mock util/date — use vi.setSystemTime or real impl)
- [x] components/experiment-data/table-cells/array/experiment-data-table-array-cell.test.tsx
- [x] components/experiment-data/table-cells/chart/experiment-data-table-chart-cell.test.tsx
- [x] components/experiment-data/table-cells/error/experiment-data-table-error-cell.test.tsx
- [x] components/experiment-data/table-cells/map/experiment-data-table-map-cell.test.tsx
- [x] components/experiment-data/table-cells/struct/experiment-data-table-struct-cell.test.tsx
- [x] components/experiment-data/table-cells/text/experiment-data-table-text-cell.test.tsx
- [x] components/experiment-data/table-cells/user/experiment-data-table-user-cell.test.tsx
- [x] components/experiment-data/table-cells/variant/experiment-data-table-variant-cell.test.tsx
- [x] components/experiment-data/table-chart/experiment-data-table-chart.test.tsx ← pragmatic exception (LineChart with importOriginal)
- [x] components/experiment-overview-cards.test.tsx
- [x] components/experiment-overview/experiment-description.test.tsx ← pragmatic exception (RichTextarea with importOriginal)
- [-] components/experiment-overview/experiment-details/experiment-details-card.test.tsx ← INTERNAL_MOCK (vi.mock util/date — use vi.setSystemTime or real impl)
- [x] components/experiment-overview/experiment-details/experiment-locations-section.test.tsx ← sibling mocks only
- [x] components/experiment-overview/experiment-title.test.tsx
- [x] components/experiment-settings/experiment-archive.test.tsx
- [x] components/experiment-settings/experiment-delete.test.tsx ← vi.mocked on global spies only
- [-] components/experiment-settings/experiment-info-card.test.tsx ← INLINE_DATA (inline Experiment object → createExperiment factory)
- [x] components/experiment-visualizations/chart-configurators/appearance/basic/line-chart/line-chart-appearance-configurator.test.tsx ← sibling mock
- [x] components/experiment-visualizations/chart-configurators/appearance/basic/scatter-chart/scatter-chart-appearance-configurator.test.tsx ← sibling mock
- [x] components/experiment-visualizations/chart-configurators/appearance/shared/display-options-section.test.tsx
- [x] components/experiment-visualizations/chart-configurators/chart-configurator-util.test.ts
- [x] components/experiment-visualizations/chart-configurators/data/basic/line-chart/line-chart-data-configurator.test.tsx ← sibling mocks
- [x] components/experiment-visualizations/chart-configurators/data/basic/scatter-chart/scatter-chart-data-configurator.test.tsx ← sibling mocks
- [x] components/experiment-visualizations/chart-configurators/data/shared/color-dimension-configuration.test.tsx
- [x] components/experiment-visualizations/chart-configurators/data/shared/x-axis-configuration.test.tsx
- [x] components/experiment-visualizations/chart-configurators/data/shared/y-axis-configuration.test.tsx
- [x] components/experiment-visualizations/chart-preview/chart-preview-modal.test.tsx ← sibling mock only
- [x] components/experiment-visualizations/chart-renderers/basic/line-chart/line-chart-renderer.test.tsx ← pragmatic exception (LineChart with importOriginal), AUDIT FIX (inline viz → createVisualization)
- [x] components/experiment-visualizations/chart-renderers/basic/scatter-chart/scatter-chart-renderer.test.tsx ← pragmatic exception (ScatterChart with importOriginal), AUDIT FIX (inline viz → createVisualization)
- [x] components/experiment-visualizations/experiment-visualization-details.test.tsx ← sibling mock only
- [x] components/experiment-visualizations/experiment-visualization-renderer.test.tsx ← sibling + next/dynamic mocks, AUDIT FIX (inline viz → createVisualization)
- [-] components/experiment-visualizations/experiment-visualizations-list.test.tsx ← INTERNAL_MOCK (vi.mock util/date — use vi.setSystemTime or real impl)
- [x] components/experiment-visualizations/wizard-steps/appearance-step.test.tsx ← sibling mocks
- [x] components/experiment-visualizations/wizard-steps/basic-info-step.test.tsx ← sibling mock
- [-] components/experiment-visualizations/wizard-steps/chart-type-step.test.tsx ← INTERNAL_MOCK (vi.mock chart-configurator-util — import real util)
- [x] components/flow-editor/**tests**/flow-conversion.test.ts
- [-] components/flow-editor/**tests**/flow-mapper.test.ts ← INLINE_DATA (inline Flow — use createFlow factory)
- [x] components/language-switcher.test.tsx ← vi.mocked on global spies only
- [x] components/list-macros.test.tsx ← sibling mock only
- [x] components/macro-code-editor.test.tsx ← @monaco-editor mock (external lib)
- [x] components/macro-code-viewer.test.tsx ← @monaco-editor mock (external lib)
- [x] components/macro-settings/macro-details-card.test.tsx ← sibling mock only
- [x] components/macro-settings/macro-info-card.test.tsx ← vi.mocked on global spies only, AUDIT FIX (inline macro → createMacro)
- [x] components/macro-settings/macro-settings.test.tsx ← sibling mocks only
- [x] components/navigation/nav-items/nav-items.test.tsx ← vi.mocked on global spies only
- [x] components/navigation/nav-user/nav-user.test.tsx
- [x] components/navigation/navigation-config.test.ts
- [x] components/navigation/navigation-mobile-nav-item/navigation-mobile-nav-item.test.tsx
- [x] components/navigation/navigation-sidebar/navigation-sidebar.test.tsx ← sibling mock only
- [x] components/navigation/unified-navbar/unified-navbar.test.tsx ← pragmatic exception (DropdownMenu with importActual), AUDIT FIX (inline Session → createSession)
- [x] components/new-macro/new-macro-details-card.test.tsx ← pragmatic exception (RichTextarea with importActual)
- [x] components/new-macro/new-macro.test.tsx ← boundary mocks only (auth, hookform resolver, base64, siblings)
- [x] components/protocol-search-popover.test.tsx ← REFACTORED (factories, userEvent.setup, removed Rule 7 mocks)
- [x] components/question-card/boolean-answer-display/boolean-answer-display.test.tsx
- [x] components/question-card/bulk-add-options-dialog/bulk-add-options-dialog.test.tsx
- [x] components/question-card/delete-all-options-dialog/delete-all-options-dialog.test.tsx
- [x] components/question-card/number-answer-display/number-answer-display.test.tsx
- [x] components/question-card/question-card.test.tsx
- [x] components/question-card/select-options-editor/select-options-editor.test.tsx
- [x] components/question-card/text-answer-display/text-answer-display.test.tsx
- [x] components/react-flow/**tests**/base-node.test.tsx ← sibling mocks
- [x] components/react-flow/**tests**/flow-utils.test.tsx ← sibling mocks
- [x] components/react-flow/**tests**/node-handles.test.tsx ← sibling + @xyflow/react mocks
- [x] components/side-panel-flow/**tests**/edge-panel.test.tsx
- [x] components/side-panel-flow/**tests**/instruction-panel.test.tsx ← pragmatic exception (RichTextarea with importActual)
- [x] components/side-panel-flow/**tests**/question-panel.test.tsx
- [x] components/side-panel-flow/**tests**/side-panel-flow.test.tsx ← sibling mocks only
- [x] components/transfer-request-form.test.tsx

### Needs changes

- [x] components/**tests**/macro-search-popover.test.tsx ← REFACTORED (removed redundant useLocale mock)
- [x] components/**tests**/protocol-code-editor.test.tsx ← pragmatic exception (useDebounce timer utility, Monaco can't render in jsdom)
- [x] components/experiment-data/data-export-modal/**tests**/data-export-modal.test.tsx ← REFACTORED (server.mount, removed globalThis.React)
- [x] components/experiment-data/data-export-modal/**tests**/export-list-step.test.tsx ← REFACTORED (server.mount, removed @repo/ui mock), AUDIT FIX (inline ExportRecord → createExportRecord)
- [x] components/experiment-data/data-export-modal/**tests**/format-selection-step.test.tsx ← REFACTORED (zero mocks, real @repo/ui components)
- [x] components/experiment-data/data-upload-modal/data-upload-modal.test.tsx ← REFACTORED (removed globalThis.React)
- [-] components/experiment-data/data-upload-modal/steps/file-upload-step.test.tsx ← REFACTORED (server.mount, FileUpload pragmatic mock), INTERNAL_MOCK (vi.mock data-upload-validation)
- [x] components/experiment-data/data-upload-modal/steps/sensor-selection-step.test.tsx ← REFACTORED (removed globalThis.React)
- [x] components/experiment-data/data-upload-modal/steps/success-step.test.tsx ← REFACTORED (removed globalThis.React)
- [x] components/experiment-data/experiment-data-table.test.tsx ← REFACTORED (useExperimentData pragmatic mock, removed tsr mock)
- [x] components/experiment-data/experiment-data-utils.test.tsx ← REFACTORED (removed @repo/ui + lucide mocks)
- [x] components/experiment-overview/experiment-linked-protocols/experiment-linked-protocols.test.tsx ← REFACTORED (server.mount + createFlow/createFlowNode factories)
- [x] components/experiment-overview/experiment-linked-protocols/protocol-card.test.tsx ← REFACTORED (server.mount, removed hook mock)
- [x] components/experiment-overview/experiment-measurements.test.tsx ← REFACTORED (server.mount + createExperimentDataTable factory)
- [x] components/experiment-settings/experiment-location-management-card.test.tsx ← REFACTORED (server.mount, removed @repo/ui + lucide mocks)
- [x] components/experiment-settings/experiment-member-management-card.test.tsx ← REFACTORED (server.mount, removed globalThis.React), AUDIT FIX (redundant @repo/auth/client mock → vi.mocked(useSession))
- [x] components/experiment-settings/experiment-visibility-card.test.tsx ← REFACTORED (removed hook mock + globalThis.React, mutation hook safe without mock)
- [x] components/experiment-visualizations/chart-preview/chart-preview.test.tsx ← REFACTORED (server.mount, removed hook mock)
- [x] components/experiment-visualizations/edit-visualization-form.test.tsx ← REFACTORED (server.mount, removed @repo/ui mock)
- [x] components/experiment-visualizations/experiment-visualizations-display.test.tsx ← REFACTORED (server.mount, removed hook mock)
- [x] components/experiment-visualizations/new-visualization-form.test.tsx ← REFACTORED (server.mount, removed @repo/ui mock)
- [x] components/experiment-visualizations/wizard-steps/data-source-step.test.tsx ← REFACTORED (useExperimentData pragmatic mock, Radix Select mock)
- [x] components/experiment/experiment-locations-display.test.tsx ← REFACTORED (full rewrite 327→105 lines, removed CSS selectors, local types, factory-ized data)
- [-] components/flow-editor/**tests**/flow-editor.test.tsx ← REFACTORED (removed globalThis.React, beforeEach cleanup), INTERNAL_MOCK (vi.mock node-config, flow-utils, flow-mapper)
- [x] components/macro-overview-cards.test.tsx ← REFACTORED (replaced local makeMacro with createMacro factory)
- [x] components/navigation/navigation-breadcrumbs/navigation-breadcrumbs.test.tsx ← REFACTORED (mock server action instead of hook, async waitFor)
- [-] components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper.test.tsx ← REFACTORED (removed globalThis.React), INTERNAL_MOCK (vi.mock navigation-config)
- [x] components/navigation/navigation-topbar/navigation-topbar.test.tsx ← REFACTORED (409→100 lines, sibling NavUser mock, useSidebar pragmatic mock)
- [x] components/new-experiment/**tests**/new-experiment.test.tsx ← REFACTORED (server.mount, WizardForm pragmatic mock)
- [x] components/new-experiment/new-experiment-locations-card.test.tsx ← REFACTORED (removed vi.clearAllMocks)
- [x] components/new-experiment/new-experiment-members-card.test.tsx ← REFACTORED (server.mount, removed globalThis.React), AUDIT FIX (redundant @repo/auth/client mock → vi.mocked(useSession))
- [x] components/new-experiment/new-experiment-visibility-card.test.tsx ← REFACTORED (imported renderWithForm, removed globalThis.React)
- [x] components/new-experiment/steps/review-step/review-step.test.tsx ← REFACTORED (removed globalThis.React)
- ~~components/new-macro/new-macro.spec.tsx~~ ← DELETED (superseded by new-macro.test.tsx)
- [x] components/new-protocol/**tests**/new-protocol.test.tsx ← REFACTORED (server.mount, userEvent conversion)
- [x] components/protocol-overview-cards.test.tsx ← REFACTORED (replaced local makeProtocol with createProtocol factory)
- [x] components/protocol-settings/**tests**/protocol-details-card.test.tsx ← REFACTORED (server.mount, userEvent conversion)
- [-] components/protocol-settings/protocol-info-card.test.tsx ← REFACTORED (removed redundant useLocale/navigation/posthog mocks, vi.mocked on globals), INTERNAL_MOCK (vi.mock util/date)
- [x] components/react-flow/**tests**/node-utils.test.tsx ← REFACTORED (removed globalThis.React)
- [x] components/side-panel-flow/**tests**/analysis-panel-flow.test.tsx ← REFACTORED (removed vi.clearAllMocks)
- [x] components/side-panel-flow/**tests**/measurement-panel.test.tsx ← REFACTORED (server.mount, removed hook mock)

## hooks/ (42/42 done)

### Already reviewed & done

- [x] hooks/auth/useSignInEmail/useSignInEmail.test.tsx ← vi.mocked on global auth spies only
- [x] hooks/auth/useSignOut/useSignOut.test.tsx ← vi.mocked on global auth spies only
- [x] hooks/auth/useUpdateUser/useUpdateUser.test.tsx ← vi.mocked on global auth spies only
- [x] hooks/auth/useVerifyEmail/useVerifyEmail.test.tsx ← vi.mocked on global auth spies only
- [x] hooks/breadcrumbs/useBreadcrumbs.test.tsx ← action mock + vi.mocked on global spies
- [x] hooks/experiment/useExperimentAccess/useExperimentAccess.test.tsx ← uses server.mount
- [x] hooks/experiment/useExperimentLocations/useExperimentLocations.test.ts ← uses server.mount
- [x] hooks/experiment/useExperimentTables/useExperimentTables.test.ts ← uses server.mount
- [x] hooks/experiment/useExperimentUpdate/useExperimentUpdate.test.tsx ← uses server.mount
- [x] hooks/experiment/useExperimentVisualization/useExperimentVisualization.test.ts ← uses server.mount
- [x] hooks/locations/useLocationGeocode.test.ts ← uses server.mount
- [x] hooks/locations/useLocationSearch.test.ts ← uses server.mount
- [x] hooks/macro/useMacro/useMacro.test.tsx ← uses server.mount
- [x] hooks/macro/useMacroCreate/useMacroCreate.test.tsx ← uses server.mount
- [x] hooks/macro/useMacroDelete/useMacroDelete.test.tsx ← uses server.mount
- [x] hooks/macro/useMacros/useMacros.test.tsx ← uses server.mount
- [x] hooks/profile/useGetUserProfile/useGetUserProfile.test.tsx ← uses server.mount
- [x] hooks/protocol/useProtocol/useProtocol.test.tsx ← uses server.mount
- [x] hooks/useTransferRequests/useTransferRequests.test.tsx ← uses server.mount

### Needs changes

- [x] hooks/experiment/annotations/useExperimentAnnotationAdd/useExperimentAnnotationAdd.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/annotations/useExperimentAnnotationAddBulk/useExperimentAnnotationAddBulk.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/annotations/useExperimentAnnotationDelete/useExperimentAnnotationDelete.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/annotations/useExperimentAnnotationDeleteBulk/useExperimentAnnotationDeleteBulk.test.tsx ← REFACTORED (import path swap)
- [-] hooks/experiment/annotations/useExperimentAnnotationOptimisticUpdate/useExperimentAnnotationOptimisticUpdate.test.ts ← REFACTORED (import path swap), INTERNAL_MOCK (vi.mock parseAnnotations)
- [-] hooks/experiment/useDownloadExport/useDownloadExport.test.ts ← RQ_MOCK (vi.mock @tanstack/react-query — let real useMutation run, intercept fetch via MSW)
- [x] hooks/experiment/useExperimentData/useExperimentData.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentDataUpload/useExperimentDataUpload.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentLocationsAdd/useExperimentLocationsAdd.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentProtocolAdd/useExperimentProtocolAdd.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperimentVisualizations/useExperimentVisualizations.test.tsx ← REFACTORED (import path swap)
- [x] hooks/experiment/useExperiments/useExperiments.test.tsx ← pragmatic exception (useDebounce timer utility, TL_IMPORT fixed)
- [x] hooks/experiment/useInitiateExport/useInitiateExport.test.ts ← REFACTORED (import path swap)
- [x] hooks/experiment/useListExports/useListExports.test.ts ← REFACTORED (import path swap), AUDIT FIX (inline ExportRecord → createExportRecord)
- [x] hooks/macro/useMacroUpdate/useMacroUpdate.test.tsx ← REFACTORED (import path swap)
- [x] hooks/useDebounce.test.tsx ← REFACTORED (import path swap)
- [x] hooks/useTransferRequestCreate/useTransferRequestCreate.test.tsx ← REFACTORED (import path swap)

## lib/ & util/ (5/5 done)

- [x] lib/posthog-server.test.ts ← system boundary mocks (env, posthog-node)
- [x] util/**tests**/base64.test.ts
- [x] util/format-file-size.test.ts
- [x] util/format-row-count.test.ts
- [x] util/query-retry.test.ts

---

## Summary

| Section     | Done `[x]` | Violations `[-]` |   Total |
| ----------- | ---------: | ---------------: | ------: |
| app/        |         54 |                1 |      55 |
| components/ |        128 |               10 |     138 |
| hooks/      |         40 |                2 |      42 |
| lib/util/   |          5 |                0 |       5 |
| **Total**   |    **227** |           **13** | **240** |

**Progress: 240/240 (100%) — Migration complete!**

### Remaining violations (`[-]` files)

| Code          | Count | Description                                                                                                                           |
| ------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| INTERNAL_MOCK |     8 | `vi.mock` on internal modules (util/date, node-config, parseAnnotations, etc.) — ideally use `vi.setSystemTime`, real imports, or MSW |
| INLINE_DATA   |     2 | Hand-crafted inline objects instead of test factories                                                                                 |
| HOOK_MOCK     |     1 | `vi.mock` on data-fetching hooks instead of `server.mount()`                                                                          |
| RQ_MOCK       |     1 | `vi.mock @tanstack/react-query` — should let real hooks run, intercept via MSW                                                        |
| GLOBAL_REDECL |     0 | All 3 instances fixed during audit                                                                                                    |

### Audit fixes applied

- **14 files**: Fixed broken `@/test/msw/node` → `@/test/msw/server` import path
- **3 files**: Removed redundant `@repo/auth/client` / `@repo/i18n/client` re-declarations (GLOBAL_REDECL)
- **9 files**: Replaced inline domain entities with factory calls (`createExportRecord`, `createVisualization`, `createMacro`, `createSession`, `createUserProfile`, `createExperimentTable`)
- **1 factory**: Added `createExportRecord()` to `test/factories.ts`

> One file removed: `new-macro.spec.tsx` was deleted (superseded by `new-macro.test.tsx`).
