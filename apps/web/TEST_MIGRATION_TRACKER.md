# Test Migration Tracker

Status key: `[x]` = reviewed & done, `[-]` = needs changes, `[ ]` = not yet reviewed

### Violation codes (for `[-]` entries)

| Code         | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| HOOK_MOCK    | `vi.mock` of data-fetching hook — convert to `server.mount()`           |
| UI_MOCK      | Full `vi.mock("@repo/ui/components")` without `importOriginal` — Rule 7 |
| LUCIDE       | `vi.mock("lucide-react")` — Rule 7                                      |
| RHF_MOCK     | `vi.mock("react-hook-form")` — use `renderWithForm` from test-utils     |
| FIRE_EVENT   | Uses `fireEvent` — convert to `userEvent`                               |
| TYPE_CAST    | `as Protocol` / `as Macro` etc. — use factory functions                 |
| GLOBAL_REACT | `globalThis.React = React` — remove (unnecessary)                       |
| USE_LOCALE   | `vi.mocked(useLocale)` — redundant (globally mocked)                    |
| LOCAL_RWF    | Local `renderWithForm` — import from `@/test/test-utils`                |
| I18N_MOCK    | Custom `@repo/i18n` mock — remove (global mock returns key)             |
| TSR_MOCK     | `vi.mock("@/lib/tsr")` — use `server.mount()`                           |
| TL_IMPORT    | `@testing-library` import — use `@/test/test-utils`                     |

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
- [x] app/[locale]/platform/experiments-archive/[id]/data/page.test.tsx ← REFACTORED
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

## components/ (102/146 done)

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
- [x] components/current-members-list/member-item.test.tsx
- [x] components/dashboard/blog-posts-section.test.tsx ← system boundary mocks (contentful, @repo/cms)
- [x] components/dashboard/dashboard-banner.test.tsx
- [x] components/dashboard/dashboard-section.test.tsx
- [x] components/dashboard/user-experiments-section.test.tsx ← sibling mock only
- [x] components/experiment-data/annotations/add-annotation-dialog.test.tsx ← REFACTORED (server.mount)
- [x] components/experiment-data/annotations/bulk-actions-bar.test.tsx ← REFACTORED
- [x] components/experiment-data/annotations/delete-annotations-dialog.test.tsx ← REFACTORED
- [x] components/experiment-data/data-upload-modal/data-upload-validation.test.ts
- [x] components/experiment-data/experiment-data-table-cell-collapsible.test.tsx ← sibling mocks only
- [x] components/experiment-data/table-cells/annotations/experiment-data-table-annotations-cell.test.tsx ← util/date mock only
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
- [x] components/experiment-overview/experiment-details/experiment-details-card.test.tsx ← sibling + util/date mocks
- [x] components/experiment-overview/experiment-details/experiment-locations-section.test.tsx ← sibling mocks only
- [x] components/experiment-overview/experiment-title.test.tsx
- [x] components/experiment-settings/experiment-archive.test.tsx
- [x] components/experiment-settings/experiment-delete.test.tsx ← vi.mocked on global spies only
- [x] components/experiment-settings/experiment-info-card.test.tsx ← sibling mocks only
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
- [x] components/experiment-visualizations/chart-renderers/basic/line-chart/line-chart-renderer.test.tsx ← pragmatic exception (LineChart with importOriginal)
- [x] components/experiment-visualizations/chart-renderers/basic/scatter-chart/scatter-chart-renderer.test.tsx ← pragmatic exception (ScatterChart with importOriginal)
- [x] components/experiment-visualizations/experiment-visualization-details.test.tsx ← sibling mock only
- [x] components/experiment-visualizations/experiment-visualization-renderer.test.tsx ← sibling + next/dynamic mocks
- [x] components/experiment-visualizations/experiment-visualizations-list.test.tsx ← util/date mock only
- [x] components/experiment-visualizations/wizard-steps/appearance-step.test.tsx ← sibling mocks
- [x] components/experiment-visualizations/wizard-steps/basic-info-step.test.tsx ← sibling mock
- [x] components/experiment-visualizations/wizard-steps/chart-type-step.test.tsx ← sibling mocks
- [x] components/flow-editor/**tests**/flow-conversion.test.ts
- [x] components/flow-editor/**tests**/flow-mapper.test.ts
- [x] components/language-switcher.test.tsx ← vi.mocked on global spies only
- [x] components/list-macros.test.tsx ← sibling mock only
- [x] components/macro-code-editor.test.tsx ← @monaco-editor mock (external lib)
- [x] components/macro-code-viewer.test.tsx ← @monaco-editor mock (external lib)
- [x] components/macro-settings/macro-details-card.test.tsx ← sibling mock only
- [x] components/macro-settings/macro-info-card.test.tsx ← vi.mocked on global spies only
- [x] components/macro-settings/macro-settings.test.tsx ← sibling mocks only
- [x] components/navigation/nav-items/nav-items.test.tsx ← vi.mocked on global spies only
- [x] components/navigation/nav-user/nav-user.test.tsx
- [x] components/navigation/navigation-config.test.ts
- [x] components/navigation/navigation-mobile-nav-item/navigation-mobile-nav-item.test.tsx
- [x] components/navigation/navigation-sidebar/navigation-sidebar.test.tsx ← sibling mock only
- [x] components/navigation/unified-navbar/unified-navbar.test.tsx ← pragmatic exception (DropdownMenu with importActual)
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

- [-] components/**tests**/macro-search-popover.test.tsx ← USE_LOCALE
- [-] components/**tests**/protocol-code-editor.test.tsx ← HOOK_MOCK (useDebounce)
- [-] components/experiment-data/data-export-modal/**tests**/data-export-modal.test.tsx ← HOOK_MOCK, GLOBAL_REACT
- [-] components/experiment-data/data-export-modal/**tests**/export-list-step.test.tsx ← HOOK_MOCK, UI_MOCK, GLOBAL_REACT
- [-] components/experiment-data/data-export-modal/**tests**/format-selection-step.test.tsx ← UI_MOCK, RHF_MOCK, GLOBAL_REACT
- [-] components/experiment-data/data-upload-modal/data-upload-modal.test.tsx ← GLOBAL_REACT
- [-] components/experiment-data/data-upload-modal/steps/file-upload-step.test.tsx ← HOOK_MOCK, UI_MOCK, I18N_MOCK, GLOBAL_REACT
- [-] components/experiment-data/data-upload-modal/steps/sensor-selection-step.test.tsx ← GLOBAL_REACT
- [-] components/experiment-data/data-upload-modal/steps/success-step.test.tsx ← GLOBAL_REACT
- [-] components/experiment-data/experiment-data-table.test.tsx ← TSR_MOCK, FIRE_EVENT
- [-] components/experiment-data/experiment-data-utils.test.tsx ← UI_MOCK, LUCIDE
- [-] components/experiment-overview/experiment-linked-protocols/experiment-linked-protocols.test.tsx ← HOOK_MOCK
- [-] components/experiment-overview/experiment-linked-protocols/protocol-card.test.tsx ← HOOK_MOCK, TYPE_CAST
- [-] components/experiment-overview/experiment-measurements.test.tsx ← HOOK_MOCK
- [-] components/experiment-settings/experiment-location-management-card.test.tsx ← UI_MOCK, LUCIDE, HOOK_MOCK, TSR_MOCK, GLOBAL_REACT
- [-] components/experiment-settings/experiment-member-management-card.test.tsx ← HOOK_MOCK, GLOBAL_REACT
- [-] components/experiment-settings/experiment-visibility-card.test.tsx ← HOOK_MOCK, GLOBAL_REACT
- [-] components/experiment-visualizations/chart-preview/chart-preview.test.tsx ← HOOK_MOCK
- [-] components/experiment-visualizations/edit-visualization-form.test.tsx ← HOOK_MOCK, UI_MOCK
- [-] components/experiment-visualizations/experiment-visualizations-display.test.tsx ← HOOK_MOCK
- [-] components/experiment-visualizations/new-visualization-form.test.tsx ← HOOK_MOCK, UI_MOCK
- [-] components/experiment-visualizations/wizard-steps/data-source-step.test.tsx ← HOOK_MOCK, UI_MOCK
- [-] components/experiment/experiment-locations-display.test.tsx ← GLOBAL_REACT
- [-] components/flow-editor/**tests**/flow-editor.test.tsx ← HOOK_MOCK, GLOBAL_REACT
- [-] components/macro-overview-cards.test.tsx ← TYPE_CAST
- [-] components/navigation/navigation-breadcrumbs/navigation-breadcrumbs.test.tsx ← HOOK_MOCK
- [-] components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper.test.tsx ← GLOBAL_REACT
- [-] components/navigation/navigation-topbar/navigation-topbar.test.tsx ← HOOK_MOCK
- [-] components/new-experiment/**tests**/new-experiment.test.tsx ← HOOK_MOCK, UI_MOCK, GLOBAL_REACT
- [-] components/new-experiment/new-experiment-locations-card.test.tsx ← HOOK_MOCK
- [-] components/new-experiment/new-experiment-members-card.test.tsx ← HOOK_MOCK, LOCAL_RWF, GLOBAL_REACT
- [-] components/new-experiment/new-experiment-visibility-card.test.tsx ← GLOBAL_REACT, LOCAL_RWF
- [-] components/new-experiment/steps/review-step/review-step.test.tsx ← GLOBAL_REACT
- [-] components/new-macro/new-macro.spec.tsx ← HOOK_MOCK, UI_MOCK, RHF_MOCK, FIRE_EVENT
- [-] components/new-protocol/**tests**/new-protocol.test.tsx ← HOOK_MOCK, FIRE_EVENT
- [-] components/protocol-overview-cards.test.tsx ← TYPE_CAST
- [-] components/protocol-settings/**tests**/protocol-details-card.test.tsx ← HOOK_MOCK, FIRE_EVENT
- [-] components/protocol-settings/protocol-info-card.test.tsx ← HOOK_MOCK
- [-] components/react-flow/**tests**/node-utils.test.tsx ← GLOBAL_REACT
- [-] components/side-panel-flow/**tests**/analysis-panel-flow.test.tsx ← HOOK_MOCK
- [-] components/side-panel-flow/**tests**/measurement-panel.test.tsx ← HOOK_MOCK

## hooks/ (19/42 done)

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

- [-] hooks/experiment/annotations/useExperimentAnnotationAdd/useExperimentAnnotationAdd.test.tsx ← TL_IMPORT
- [-] hooks/experiment/annotations/useExperimentAnnotationAddBulk/useExperimentAnnotationAddBulk.test.tsx ← TL_IMPORT
- [-] hooks/experiment/annotations/useExperimentAnnotationDelete/useExperimentAnnotationDelete.test.tsx ← TL_IMPORT
- [-] hooks/experiment/annotations/useExperimentAnnotationDeleteBulk/useExperimentAnnotationDeleteBulk.test.tsx ← TL_IMPORT
- [-] hooks/experiment/annotations/useExperimentAnnotationOptimisticUpdate/useExperimentAnnotationOptimisticUpdate.test.ts ← TL_IMPORT
- [-] hooks/experiment/useDownloadExport/useDownloadExport.test.ts ← TL_IMPORT
- [-] hooks/experiment/useExperimentData/useExperimentData.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentDataUpload/useExperimentDataUpload.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentLocationsAdd/useExperimentLocationsAdd.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentLocationsUpdate/useExperimentLocationsUpdate.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentMemberRoleUpdate/useExperimentMemberRoleUpdate.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentProtocolAdd/useExperimentProtocolAdd.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperimentVisualizations/useExperimentVisualizations.test.tsx ← TL_IMPORT
- [-] hooks/experiment/useExperiments/useExperiments.test.tsx ← HOOK_MOCK (useDebounce)
- [-] hooks/experiment/useInitiateExport/useInitiateExport.test.ts ← TL_IMPORT
- [-] hooks/experiment/useListExports/useListExports.test.ts ← TL_IMPORT
- [-] hooks/macro/useMacroUpdate/useMacroUpdate.test.tsx ← TL_IMPORT
- [-] hooks/useDebounce.test.tsx ← TL_IMPORT
- [-] hooks/useTransferRequestCreate/useTransferRequestCreate.test.tsx ← TL_IMPORT

## lib/ & util/ (5/5 done)

- [x] lib/posthog-server.test.ts ← system boundary mocks (env, posthog-node)
- [x] util/**tests**/base64.test.ts
- [x] util/format-file-size.test.ts
- [x] util/format-row-count.test.ts
- [x] util/query-retry.test.ts

---

## Summary

| Section     |    Done | Remaining |   Total |
| ----------- | ------: | --------: | ------: |
| app/        |      55 |         0 |      55 |
| components/ |     102 |        44 |     146 |
| hooks/      |      19 |        23 |      42 |
| lib/util/   |       5 |         0 |       5 |
| **Total**   | **181** |    **67** | **248** |

**Progress: 181/248 (73%)**

### Remaining work breakdown (67 files)

| Violation                   | Files affected | Effort                                 |
| --------------------------- | -------------: | -------------------------------------- |
| GLOBAL_REACT only           |              9 | Trivial (delete 1 line each)           |
| USE_LOCALE only             |              1 | Trivial                                |
| TYPE_CAST only              |              2 | Trivial (swap to factory)              |
| HOOK_MOCK (±other issues)   |             28 | Medium–Heavy (server.mount conversion) |
| UI_MOCK / LUCIDE / RHF_MOCK |             10 | Medium (remove mock, fix queries)      |
| FIRE_EVENT                  |              4 | Medium (userEvent conversion)          |
| LOCAL_RWF                   |              2 | Low (import from test-utils)           |
| TL_IMPORT (hooks only)      |             22 | Low (import path swap)                 |
